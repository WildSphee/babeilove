"""Offline bot conversations and file storage tests; never connect to Telegram."""

import json
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from PIL import ExifTags, Image

from backend import memory_bot as bot
from backend.media_dates import date_warning, extract_photo_date, parse_input_date
from backend.storage import MemoryStore, read_memories_module


class DateTests(unittest.TestCase):
    def test_ddmmyy_and_century(self):
        self.assertEqual(parse_input_date(' 210926 '), '2026-09-21')
        self.assertEqual(parse_input_date('290224'), '2024-02-29')
        self.assertEqual(parse_input_date('010199'), '2099-01-01')

    def test_invalid_dates(self):
        for value in ('2026-09-21', '21926', '310426', '290225', '000026', '211326', 'abcdef', '２１０９２６'):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'ddmmyy'):
                parse_input_date(value)

    def test_warning_boundaries(self):
        today = date(2026, 9, 21)
        for value in ('2026-09-21', '2025-09-21', '2026-01-01'):
            self.assertIsNone(date_warning(value, today))
        self.assertEqual(date_warning('2026-09-22', today), 'in the future')
        self.assertEqual(date_warning('2025-09-20', today), 'more than one year ago')
        self.assertIsNone(date_warning('2023-02-28', date(2024, 2, 29)))
        self.assertIsNone(date_warning('2024-02-29', date(2025, 2, 28)))

    def test_exif_capture_time_preferred_over_modified_time(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'photo.jpg'
            exif = Image.Exif()
            exif[ExifTags.Base.DateTime] = '2026:09:21 12:00:00'
            exif[ExifTags.IFD.Exif] = {ExifTags.Base.DateTimeOriginal: '2025:10:12 23:30:00'}
            Image.new('RGB', (8, 8)).save(path, exif=exif)
            self.assertEqual(extract_photo_date(path), '2025-10-12')

    def test_missing_invalid_and_fallback_exif(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'photo.jpg'
            Image.new('RGB', (8, 8)).save(path)
            self.assertIsNone(extract_photo_date(path))
            exif = Image.Exif()
            exif[ExifTags.Base.DateTimeOriginal] = 'not a date'
            exif[ExifTags.Base.DateTimeDigitized] = '2026:02:01 01:02:03'
            Image.new('RGB', (8, 8)).save(path, exif=exif)
            self.assertEqual(extract_photo_date(path), '2026-02-01')
            path.write_bytes(b'corrupt image or unsupported video')
            self.assertIsNone(extract_photo_date(path))


class StorageTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.store = MemoryStore(Path(directory.name))
        self.original = [
            {'image': image, 'date': day, 'description': image, 'extra': 'keep'}
            for image, day in [('top.jpg', '2026-09-21'), ('z.jpg', '2026-09-20'),
                               ('a.jpg', '2026-09-20'), ('b.jpg', '2026-09-20'), ('old.jpg', '2026-09-19')]
        ]
        self.store.memories_path.write_text('export default ' + json.dumps({'config': {'title': 'Keep'}, 'memories': self.original}) + ';')

    def test_move_first_persists_and_preserves_other_order_and_fields(self):
        selected = self.store.list_memories()[3]
        self.assertEqual(self.store.move_to_first_in_day(selected.id), selected)
        data = read_memories_module(self.store.memories_path)
        self.assertEqual(data['memories'], [self.original[i] for i in (0, 3, 1, 2, 4)])
        self.assertEqual(data['config'], {'title': 'Keep'})
        self.store.move_to_first_in_day(selected.id)
        self.assertEqual(read_memories_module(self.store.memories_path), data)

    def test_order_survives_add_caption_date_and_media_edits(self):
        selected = self.store.list_memories()[3]
        self.store.move_to_first_in_day(selected.id)
        added = self.store.add_memory(image_filename='zz.jpg', date=selected.date, description='New')
        changed = self.store.update_caption(selected.id, 'Changed')
        changed = self.store.replace_media(changed.id, 'aa.jpg')
        self.store.update_date(added.id, '2026-09-19')
        same_day = [m.image for m in self.store.list_memories() if m.date == selected.date]
        self.assertEqual(same_day, ['aa.jpg', 'z.jpg', 'a.jpg'])

    def test_missing_memory_does_not_write(self):
        before = self.store.memories_path.read_bytes()
        with self.assertRaises(KeyError):
            self.store.move_to_first_in_day('missing')
        self.assertEqual(self.store.memories_path.read_bytes(), before)


class BotFlowTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.store = MemoryStore(self.root)
        self.store.memories_path.write_text('export default {"config": {}, "memories": []};')
        for name, replacement in (
            ('store', self.store), ('ALLOWED_USERNAMES', {'tester'}),
            ('maybe_run_post_update', AsyncMock()),
            ('refresh_or_send_memory_list', AsyncMock()),
            ('render_memory_detail_by_id', AsyncMock()),
            ('date_warning', lambda value: date_warning(value, date(2026, 9, 21))),
        ):
            patcher = patch.object(bot, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.message = SimpleNamespace(text='', photo=[], video=None, document=None, reply_text=AsyncMock())
        self.update = SimpleNamespace(effective_user=SimpleNamespace(username='tester'), effective_message=self.message,
                                      effective_chat=SimpleNamespace(id=1), callback_query=None)
        self.context = SimpleNamespace(user_data={}, bot=SimpleNamespace(send_chat_action=AsyncMock()))

    async def text(self, value):
        self.message.text = value
        await bot.handle_text(self.update, self.context)

    async def click(self, data=None):
        if data is None:
            data = 'date:' + self.context.user_data['date_prompt']['token']
        self.update.callback_query = SimpleNamespace(data=data, message=self.message, answer=AsyncMock())
        await bot.handle_callback(self.update, self.context)
        self.update.callback_query = None

    async def upload(self, exif_date=None, kind='photo'):
        await bot.new_memory(self.update, self.context)
        source = self.root / 'upload.jpg'
        exif = Image.Exif()
        if exif_date:
            exif[ExifTags.IFD.Exif] = {ExifTags.Base.DateTimeOriginal: exif_date}
        Image.new('RGB', (8, 8)).save(source, exif=exif)
        async def download(custom_path):
            shutil.copyfile(source, custom_path)
        media = SimpleNamespace(get_file=AsyncMock(return_value=SimpleNamespace(download_to_drive=AsyncMock(side_effect=download))),
                                file_name='upload.jpg', mime_type='image/jpeg')
        if kind == 'photo':
            self.message.photo = [media]
        else:
            self.message.document = media
        await bot.handle_media(self.update, self.context)
        self.message.photo = []
        self.message.document = None
        return self.store.media_dir / self.context.user_data['new_memory']['image']

    async def test_start_and_photo_first(self):
        await bot.start(self.update, self.context)
        await bot.new_memory(self.update, self.context)
        await self.text('210926')
        self.assertEqual(self.context.user_data['action'], bot.ACTION_NEW_MEDIA)
        self.assertEqual(self.store.list_memories(), [])

    async def test_exif_document_confirm_then_description_commits_once(self):
        path = await self.upload('2026:09:20 12:00:00', kind='document')
        self.assertEqual(self.context.user_data['date_prompt']['date'], '2026-09-20')
        keyboard = self.message.reply_text.call_args.kwargs['reply_markup']
        self.assertEqual(keyboard.inline_keyboard[0][0].text, 'Yes use this date')
        self.assertEqual(self.store.list_memories(), [])
        await self.click()
        self.assertEqual(self.context.user_data['action'], bot.ACTION_NEW_DESCRIPTION)
        self.assertEqual(self.store.list_memories(), [])
        await self.text('   ')
        self.assertEqual(self.store.list_memories(), [])
        await self.text('A lovely day')
        await self.text('duplicate description')
        records = self.store.list_memories()
        self.assertEqual(len(records), 1)
        self.assertEqual((records[0].date, records[0].description), ('2026-09-20', 'A lovely day'))
        self.assertTrue(path.exists())
        bot.maybe_run_post_update.assert_awaited_once()

    async def test_no_exif_manual_date_and_invalid_input(self):
        await self.upload()
        self.assertNotIn('date_prompt', self.context.user_data)
        await self.text('2026-09-21')
        self.assertEqual(self.context.user_data['action'], bot.ACTION_NEW_DATE)
        await self.text('210926')
        await self.text('Manual date')
        self.assertEqual(self.store.list_memories()[0].date, '2026-09-21')

    async def test_manual_date_overrides_exif_and_expires_button(self):
        await self.upload('2026:09:20 12:00:00')
        stale = 'date:' + self.context.user_data['date_prompt']['token']
        await self.text('190926')
        await self.click(stale)
        self.assertEqual(self.context.user_data['new_memory']['date'], '2026-09-19')
        self.assertEqual(self.context.user_data['action'], bot.ACTION_NEW_DESCRIPTION)

    async def test_future_and_old_manual_dates_require_confirmation(self):
        for value, expected in [('220926', 'in the future'), ('200925', 'more than one year ago')]:
            with self.subTest(value=value):
                await self.upload()
                await self.text(value)
                self.assertEqual(self.context.user_data['action'], bot.ACTION_CONFIRM_DATE)
                self.assertIn(expected, self.message.reply_text.call_args.args[0])
                self.assertNotIn('date', self.context.user_data['new_memory'])
                await self.click()
                self.assertEqual(self.context.user_data['action'], bot.ACTION_NEW_DESCRIPTION)

    async def test_unusual_exif_needs_additional_warning_confirmation(self):
        await self.upload('2024:01:01 12:00:00')
        stale = 'date:' + self.context.user_data['date_prompt']['token']
        await self.click()
        self.assertEqual(self.context.user_data['action'], bot.ACTION_CONFIRM_DATE)
        await self.click(stale)
        self.assertEqual(self.context.user_data['action'], bot.ACTION_CONFIRM_DATE)
        await self.click()
        self.assertEqual(self.context.user_data['new_memory']['date'], '2024-01-01')

    async def test_correct_warning_date_by_typing(self):
        await self.upload()
        await self.text('220926')
        stale = 'date:' + self.context.user_data['date_prompt']['token']
        await self.text('210926')
        await self.click(stale)
        self.assertEqual(self.context.user_data['new_memory']['date'], '2026-09-21')

    async def test_cancel_and_restart_remove_pending_upload(self):
        path = await self.upload('2026:09:20 12:00:00')
        stale = 'date:' + self.context.user_data['date_prompt']['token']
        await bot.cancel(self.update, self.context)
        self.assertFalse(path.exists())
        new_path = await self.upload('2026:09:19 12:00:00')
        await self.click(stale)
        self.assertEqual(self.context.user_data['date_prompt']['date'], '2026-09-19')
        await bot.new_memory(self.update, self.context)
        self.assertFalse(new_path.exists())
        self.assertEqual(self.store.list_memories(), [])

    async def test_edit_date_warning_defers_write(self):
        record = self.store.add_memory(image_filename='existing.jpg', date='2026-09-20', description='Keep')
        await self.click(f'ed:0:{record.id}')
        await self.text('010124')
        self.assertEqual(self.store.list_memories()[0], record)
        await self.click()
        self.assertEqual(self.store.list_memories()[0].date, '2024-01-01')

    async def test_reorder_callback_and_keyboard(self):
        first = self.store.add_memory(image_filename='z.jpg', date='2026-09-20', description='First')
        second = self.store.add_memory(image_filename='a.jpg', date=first.date, description='Second')
        keyboard = bot.build_memory_detail_keyboard(second, 1, 2, 0)
        callback = next(button.callback_data for row in keyboard.inline_keyboard for button in row if button.callback_data.startswith('first:'))
        await self.click(callback)
        self.assertEqual([m.id for m in self.store.list_memories()], [second.id, first.id])
        bot.maybe_run_post_update.assert_awaited_once()
        self.assertEqual(bot.render_memory_detail_by_id.call_args.kwargs['memory_id'], second.id)

    async def test_committed_media_survives_reply_failure(self):
        path = await self.upload()
        await self.text('210926')
        self.message.reply_text.side_effect = RuntimeError('Telegram unavailable')
        with self.assertRaises(RuntimeError):
            await self.text('Keep this memory')
        self.assertTrue(path.exists())
        self.assertEqual(len(self.store.list_memories()), 1)
        self.assertNotIn('action', self.context.user_data)

    async def test_unauthorized_reorder_is_rejected(self):
        record = self.store.add_memory(image_filename='a.jpg', date='2026-09-20', description='Keep')
        self.update.effective_user.username = 'outsider'
        await self.click(f'first:0:{record.id}')
        bot.maybe_run_post_update.assert_not_awaited()
        self.assertIn("don't have access", self.message.reply_text.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
