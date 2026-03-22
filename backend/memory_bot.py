from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

try:
    from .storage import IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, MemoryRecord, MemoryStore
except ImportError:
    from storage import IMAGE_EXTENSIONS, VIDEO_EXTENSIONS, MemoryRecord, MemoryStore

logging.basicConfig(
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / '.env')

BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '').strip()
ALLOWED_USERNAMES = {
    username.strip().lstrip('@').lower()
    for username in os.getenv('TELEGRAM_ALLOWED_USERNAMES', 'reagan_c,audikor').split(',')
    if username.strip()
}
POST_UPDATE_COMMAND = os.getenv('POST_UPDATE_COMMAND', '').strip() or './build.sh'

ACTION_NONE = 'none'
ACTION_NEW_DATE = 'new_date'
ACTION_NEW_DESCRIPTION = 'new_description'
ACTION_NEW_MEDIA = 'new_media'
ACTION_EDIT_CAPTION = 'edit_caption'
ACTION_EDIT_DATE = 'edit_date'
ACTION_EDIT_MEDIA = 'edit_media'

store = MemoryStore(REPO_ROOT)


def require_authorized(func):
    async def wrapped(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not await ensure_authorized(update):
            return
        await func(update, context)

    return wrapped


async def ensure_authorized(update: Update) -> bool:
    user = update.effective_user
    username = (user.username or '').lower()
    if username in ALLOWED_USERNAMES:
        return True

    if update.callback_query:
        await update.callback_query.answer('Access denied.', show_alert=True)
        await update.callback_query.message.reply_text("sorry, you don't have access to this Telegram chatbot")
    elif update.effective_message:
        await update.effective_message.reply_text("sorry, you don't have access to this Telegram chatbot")
    return False


@require_authorized
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    await update.effective_message.reply_text(
        'Commands:\n'
        '/list - show all memories\n'
        '/new - add a new memory\n'
        '/cancel - clear the current pending action'
    )


@require_authorized
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    await update.effective_message.reply_text('Pending action cleared.')


@require_authorized
async def list_memories(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    memories = store.list_memories()
    if not memories:
        await update.effective_message.reply_text('No memories found.')
        return

    await update.effective_message.reply_text(f'Showing {len(memories)} memories.')
    chat_id = update.effective_chat.id
    for index, memory in enumerate(memories, start=1):
        await send_memory_preview(context.application, chat_id, memory, index)


@require_authorized
async def new_memory(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['action'] = ACTION_NEW_DATE
    context.user_data['new_memory'] = {}
    await update.effective_message.reply_text('Send the memory date in YYYY-MM-DD format.')


@require_authorized
async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    action = context.user_data.get('action', ACTION_NONE)
    text = (update.effective_message.text or '').strip()

    try:
        if action == ACTION_NEW_DATE:
            normalized = store.normalize_date(text)
            context.user_data['new_memory'] = {'date': normalized}
            context.user_data['action'] = ACTION_NEW_DESCRIPTION
            await update.effective_message.reply_text('Send the description for this memory.')
            return

        if action == ACTION_NEW_DESCRIPTION:
            if not text:
                await update.effective_message.reply_text('Description cannot be empty. Send the description text.')
                return
            context.user_data.setdefault('new_memory', {})['description'] = text
            context.user_data['action'] = ACTION_NEW_MEDIA
            await update.effective_message.reply_text('Now send the photo or video for this memory.')
            return

        if action == ACTION_EDIT_CAPTION:
            pending_id = context.user_data.get('memory_id')
            if not pending_id:
                clear_pending_action(context)
                await update.effective_message.reply_text('The edit session expired. Refresh with /list.')
                return
            updated = store.update_caption(pending_id, text)
            clear_pending_action(context)
            await update.effective_message.reply_text(
                f'Caption updated for {updated.date}.\nUse /list to see the current order.'
            )
            await maybe_run_post_update(update)
            return

        if action == ACTION_EDIT_DATE:
            pending_id = context.user_data.get('memory_id')
            if not pending_id:
                clear_pending_action(context)
                await update.effective_message.reply_text('The edit session expired. Refresh with /list.')
                return
            updated = store.update_date(pending_id, text)
            clear_pending_action(context)
            await update.effective_message.reply_text(
                f'Date updated. This memory is now stored under {updated.date}.\nUse /list to see the current order.'
            )
            await maybe_run_post_update(update)
            return

        await update.effective_message.reply_text('Use /list or /new, or send /cancel to clear the current action.')
    except ValueError as exc:
        await update.effective_message.reply_text(str(exc))
    except KeyError as exc:
        clear_pending_action(context)
        await update.effective_message.reply_text(str(exc))


@require_authorized
async def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    action = context.user_data.get('action', ACTION_NONE)
    if action not in {ACTION_NEW_MEDIA, ACTION_EDIT_MEDIA}:
        await update.effective_message.reply_text('Use /new to create a memory or /list to edit an existing one.')
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.UPLOAD_DOCUMENT)
    saved_filename: str | None = None

    try:
        saved_filename = await download_media_from_message(update, context)
        if action == ACTION_NEW_MEDIA:
            payload = context.user_data.get('new_memory', {})
            created = store.add_memory(
                image_filename=saved_filename,
                date=payload['date'],
                description=payload['description'],
            )
            clear_pending_action(context)
            await update.effective_message.reply_text(
                f'Created new memory for {created.date} with file {created.image}.'
            )
            await maybe_run_post_update(update)
            return

        pending_id = context.user_data.get('memory_id')
        if not pending_id:
            clear_pending_action(context)
            await update.effective_message.reply_text('The edit session expired. Refresh with /list.')
            return
        updated = store.replace_media(pending_id, saved_filename)
        clear_pending_action(context)
        await update.effective_message.reply_text(
            f'Media replaced for {updated.date}. New file: {updated.image}.'
        )
        await maybe_run_post_update(update)
    except ValueError as exc:
        cleanup_saved_file(saved_filename)
        await update.effective_message.reply_text(str(exc))
    except KeyError as exc:
        cleanup_saved_file(saved_filename)
        clear_pending_action(context)
        await update.effective_message.reply_text(str(exc))
    except Exception:
        cleanup_saved_file(saved_filename)
        raise


@require_authorized
async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    try:
        action, memory_id = query.data.split(':', maxsplit=1)
    except ValueError:
        await query.message.reply_text('Invalid action payload.')
        return

    memory = store.get_memory(memory_id)
    if action not in {'delete_cancel'} and memory is None:
        clear_pending_action(context)
        await query.message.reply_text('Memory no longer exists. Refresh with /list.')
        return

    if action == 'edit':
        keyboard = InlineKeyboardMarkup(
            [
                [InlineKeyboardButton('Edit caption', callback_data=f'edit_caption:{memory_id}')],
                [InlineKeyboardButton('Edit date', callback_data=f'edit_date:{memory_id}')],
                [InlineKeyboardButton('Replace media', callback_data=f'edit_media:{memory_id}')],
            ]
        )
        await query.message.reply_text(
            f'Selected {memory.date}. Choose what to edit.',
            reply_markup=keyboard,
        )
        return

    if action == 'edit_caption':
        context.user_data['action'] = ACTION_EDIT_CAPTION
        context.user_data['memory_id'] = memory_id
        await query.message.reply_text('Send the new caption text.')
        return

    if action == 'edit_date':
        context.user_data['action'] = ACTION_EDIT_DATE
        context.user_data['memory_id'] = memory_id
        await query.message.reply_text('Send the new date in YYYY-MM-DD format.')
        return

    if action == 'edit_media':
        context.user_data['action'] = ACTION_EDIT_MEDIA
        context.user_data['memory_id'] = memory_id
        await query.message.reply_text('Send the replacement photo or video.')
        return

    if action == 'delete':
        keyboard = InlineKeyboardMarkup(
            [
                [InlineKeyboardButton('Confirm delete', callback_data=f'delete_confirm:{memory_id}')],
                [InlineKeyboardButton('Cancel', callback_data=f'delete_cancel:{memory_id}')],
            ]
        )
        await query.message.reply_text(
            f'Delete memory from {memory.date}? This also removes the local media file if no other memory uses it.',
            reply_markup=keyboard,
        )
        return

    if action == 'delete_confirm':
        deleted = store.delete_memory(memory_id)
        clear_pending_action(context)
        await query.message.reply_text(f'Deleted memory from {deleted.date}.')
        await maybe_run_post_update(update)
        return

    if action == 'delete_cancel':
        await query.message.reply_text('Delete cancelled.')
        return

    await query.message.reply_text('Unknown action.')


async def send_memory_preview(application: Application, chat_id: int, memory: MemoryRecord, index: int) -> None:
    media_path = store.media_dir / memory.image
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton('Edit', callback_data=f'edit:{memory.id}')],
            [InlineKeyboardButton('Delete', callback_data=f'delete:{memory.id}')],
        ]
    )
    caption = (
        f'#{index}\n'
        f'Date: {memory.date}\n'
        f'File: {memory.image}\n\n'
        f'{memory.description or "(no description)"}'
    )

    if not media_path.exists():
        await application.bot.send_message(chat_id=chat_id, text=f'{caption}\n\nMissing file on disk.', reply_markup=keyboard)
        return

    suffix = media_path.suffix.lower()
    with media_path.open('rb') as media_handle:
        if suffix in IMAGE_EXTENSIONS:
            await application.bot.send_photo(chat_id=chat_id, photo=media_handle, caption=caption, reply_markup=keyboard)
            return
        if suffix in VIDEO_EXTENSIONS:
            await application.bot.send_video(chat_id=chat_id, video=media_handle, caption=caption, reply_markup=keyboard)
            return
        await application.bot.send_document(chat_id=chat_id, document=media_handle, caption=caption, reply_markup=keyboard)


async def download_media_from_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
    message = update.effective_message
    telegram_file = None
    extension = None

    if message.photo:
        telegram_file = await message.photo[-1].get_file()
        extension = '.jpg'
    elif message.video:
        telegram_file = await message.video.get_file()
        extension = store.infer_extension(message.video.file_name, message.video.mime_type, '.mp4')
    elif message.document:
        extension = store.infer_extension(message.document.file_name, message.document.mime_type, '')
        if extension not in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS:
            raise ValueError('Only image or video files are supported.')
        telegram_file = await message.document.get_file()
    else:
        raise ValueError('Send a photo, video, or image/video document.')

    with NamedTemporaryFile(delete=False) as temp_handle:
        temp_path = Path(temp_handle.name)

    try:
        await telegram_file.download_to_drive(custom_path=str(temp_path))
        return store.save_media_file(temp_path, extension)
    finally:
        temp_path.unlink(missing_ok=True)


async def maybe_run_post_update(update: Update) -> None:
    if not POST_UPDATE_COMMAND:
        return

    result = await asyncio.to_thread(run_post_update_command)
    if result['returncode'] == 0:
        await update.effective_message.reply_text(
            f"Post-update command succeeded: {POST_UPDATE_COMMAND}"
        )
        return

    stderr = result['stderr'] or result['stdout'] or 'No command output.'
    await update.effective_message.reply_text(
        'Post-update command failed.\n'
        f'Command: {POST_UPDATE_COMMAND}\n'
        f'Output:\n{stderr[:3000]}'
    )


def run_post_update_command() -> dict[str, Any]:
    completed = subprocess.run(
        POST_UPDATE_COMMAND,
        cwd=REPO_ROOT,
        shell=True,
        capture_output=True,
        text=True,
        timeout=600,
    )
    return {
        'returncode': completed.returncode,
        'stdout': completed.stdout.strip(),
        'stderr': completed.stderr.strip(),
    }


def clear_pending_action(context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop('action', None)
    context.user_data.pop('memory_id', None)
    context.user_data.pop('new_memory', None)


def cleanup_saved_file(filename: str | None) -> None:
    if not filename:
        return
    target_path = store.media_dir / filename
    if target_path.exists():
        target_path.unlink()


def build_application() -> Application:
    if not BOT_TOKEN:
        raise RuntimeError('TELEGRAM_BOT_TOKEN is missing in the root .env file.')
    return ApplicationBuilder().token(BOT_TOKEN).build()


def main() -> None:
    application = build_application()
    application.add_handler(CommandHandler('start', start))
    application.add_handler(CommandHandler('help', start))
    application.add_handler(CommandHandler('cancel', cancel))
    application.add_handler(CommandHandler('list', list_memories))
    application.add_handler(CommandHandler('new', new_memory))
    application.add_handler(CallbackQueryHandler(handle_callback))
    application.add_handler(MessageHandler(filters.PHOTO | filters.VIDEO | filters.Document.ALL, handle_media))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    logger.info('Starting memory bot. Allowed usernames: %s', ', '.join(sorted(ALLOWED_USERNAMES)))
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
