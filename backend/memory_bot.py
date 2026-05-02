from __future__ import annotations

import asyncio
import logging
import os
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from dotenv import load_dotenv
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    Update,
)
from telegram.constants import ChatAction
from telegram.error import BadRequest
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
LIST_PAGE_SIZE = 6
NOOP_CALLBACK = 'noop'
BUTTON_LIST_MEMORIES = '🗂 List Memories'
BUTTON_NEW_MEMORY = '➕ New Memory'
BUTTON_COMMAND_LOOKUP = {
    BUTTON_LIST_MEMORIES: 'list',
    BUTTON_NEW_MEMORY: 'new',
}

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


def build_command_reply_markup() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(BUTTON_LIST_MEMORIES), KeyboardButton(BUTTON_NEW_MEMORY)],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder='Choose a command',
    )


async def reply_with_command_menu(message, text: str) -> None:
    await message.reply_text(text, reply_markup=build_command_reply_markup())


async def post_init(application: Application) -> None:
    await application.bot.delete_my_commands()


@require_authorized
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    await reply_with_command_menu(
        update.effective_message,
        # 'Use the buttons below or these commands:\n'
        # '/list - browse memories\n'
        # '/new - add a new memory\n'
        # '/cancel - clear the current pending action'
    )


@require_authorized
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    await reply_with_command_menu(update.effective_message, 'Pending action cleared.')


@require_authorized
async def list_memories(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    memories = store.list_memories()
    if not memories:
        await reply_with_command_menu(update.effective_message, 'No memories found.')
        return

    await refresh_or_send_memory_list(update.effective_message, context, list_page=0)


@require_authorized
async def new_memory(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data['action'] = ACTION_NEW_DATE
    context.user_data['new_memory'] = {}
    await reply_with_command_menu(update.effective_message, 'Send the memory date in YYYY-MM-DD format.')


@require_authorized
async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    action = context.user_data.get('action', ACTION_NONE)
    text = (update.effective_message.text or '').strip()
    mapped_command = BUTTON_COMMAND_LOOKUP.get(text)

    if mapped_command == 'list':
        await list_memories(update, context)
        return

    if mapped_command == 'new':
        await new_memory(update, context)
        return

    try:
        if action == ACTION_NEW_DATE:
            normalized = store.normalize_date(text)
            context.user_data['new_memory'] = {'date': normalized}
            context.user_data['action'] = ACTION_NEW_DESCRIPTION
            await reply_with_command_menu(update.effective_message, 'Send the description for this memory.')
            return

        if action == ACTION_NEW_DESCRIPTION:
            if not text:
                await reply_with_command_menu(
                    update.effective_message,
                    'Description cannot be empty. Send the description text.',
                )
                return
            context.user_data.setdefault('new_memory', {})['description'] = text
            context.user_data['action'] = ACTION_NEW_MEDIA
            await reply_with_command_menu(update.effective_message, 'Now send the photo or video for this memory.')
            return

        if action == ACTION_EDIT_CAPTION:
            pending_id = context.user_data.get('memory_id')
            if not pending_id:
                clear_pending_action(context)
                await reply_with_command_menu(update.effective_message, 'The edit session expired. Refresh with /list.')
                return
            updated = store.update_caption(pending_id, text)
            list_page = find_list_page_for_memory(
                updated.id,
                fallback=int(context.user_data.get('browser_page', 0)),
            )
            clear_pending_action(context)
            await reply_with_command_menu(update.effective_message, f'Caption updated for {updated.date}.')
            await refresh_or_send_memory_list(update.effective_message, context, list_page=list_page)
            await maybe_run_post_update(update)
            return

        if action == ACTION_EDIT_DATE:
            pending_id = context.user_data.get('memory_id')
            if not pending_id:
                clear_pending_action(context)
                await reply_with_command_menu(update.effective_message, 'The edit session expired. Refresh with /list.')
                return
            updated = store.update_date(pending_id, text)
            list_page = find_list_page_for_memory(
                updated.id,
                fallback=int(context.user_data.get('browser_page', 0)),
            )
            clear_pending_action(context)
            await reply_with_command_menu(
                update.effective_message,
                f'Date updated. This memory is now stored under {updated.date}.'
            )
            await refresh_or_send_memory_list(update.effective_message, context, list_page=list_page)
            await maybe_run_post_update(update)
            return

        await reply_with_command_menu(
            update.effective_message,
            'Use /list or /new, or send /cancel to clear the current action.',
        )
    except ValueError as exc:
        await reply_with_command_menu(update.effective_message, str(exc))
    except KeyError as exc:
        clear_pending_action(context)
        await reply_with_command_menu(update.effective_message, str(exc))


@require_authorized
async def handle_media(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    action = context.user_data.get('action', ACTION_NONE)
    if action not in {ACTION_NEW_MEDIA, ACTION_EDIT_MEDIA}:
        await reply_with_command_menu(
            update.effective_message,
            'Use /new to create a memory or /list to edit an existing one.',
        )
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
            await reply_with_command_menu(
                update.effective_message,
                f'Created new memory for {created.date} with file {created.image}.'
            )
            await refresh_or_send_memory_list(
                update.effective_message,
                context,
                list_page=find_list_page_for_memory(created.id, fallback=0),
            )
            await maybe_run_post_update(update)
            return

        pending_id = context.user_data.get('memory_id')
        if not pending_id:
            clear_pending_action(context)
            await reply_with_command_menu(update.effective_message, 'The edit session expired. Refresh with /list.')
            return
        updated = store.replace_media(pending_id, saved_filename)
        list_page = find_list_page_for_memory(
            updated.id,
            fallback=int(context.user_data.get('browser_page', 0)),
        )
        clear_pending_action(context)
        await reply_with_command_menu(
            update.effective_message,
            f'Media replaced for {updated.date}. New file: {updated.image}.'
        )
        await refresh_or_send_memory_list(update.effective_message, context, list_page=list_page)
        await maybe_run_post_update(update)
    except ValueError as exc:
        cleanup_saved_file(saved_filename)
        await reply_with_command_menu(update.effective_message, str(exc))
    except KeyError as exc:
        cleanup_saved_file(saved_filename)
        clear_pending_action(context)
        await reply_with_command_menu(update.effective_message, str(exc))
    except Exception:
        cleanup_saved_file(saved_filename)
        raise


@require_authorized
async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data or ''
    if data == NOOP_CALLBACK:
        return

    try:
        action, raw_value, *rest = data.split(':')
        value = int(raw_value)
    except (TypeError, ValueError):
        await query.message.reply_text('Invalid action payload.')
        return

    if action == 'lp':
        clear_pending_action(context)
        await render_memory_list(query.message, context, list_page=value)
        return

    if action == 'dv':
        clear_pending_action(context)
        await render_memory_detail(query.message, context, detail_index=value)
        return

    if not rest:
        await query.message.reply_text('Invalid action payload.')
        return

    memory_id = rest[0]
    memory = store.get_memory(memory_id)
    if memory is None:
        clear_pending_action(context)
        await render_memory_list(query.message, context, list_page=value, notice='Memory no longer exists.')
        return

    if action == 'lo':
        clear_pending_action(context)
        await render_memory_detail_by_id(query.message, context, memory_id=memory_id, list_page=value)
        return

    if action == 'ec':
        context.user_data['action'] = ACTION_EDIT_CAPTION
        context.user_data['memory_id'] = memory_id
        context.user_data['browser_page'] = value
        await query.message.reply_text('Send the new caption text.')
        return

    if action == 'ed':
        context.user_data['action'] = ACTION_EDIT_DATE
        context.user_data['memory_id'] = memory_id
        context.user_data['browser_page'] = value
        await query.message.reply_text('Send the new date in YYYY-MM-DD format.')
        return

    if action == 'em':
        context.user_data['action'] = ACTION_EDIT_MEDIA
        context.user_data['memory_id'] = memory_id
        context.user_data['browser_page'] = value
        await query.message.reply_text('Send the replacement photo or video.')
        return

    if action == 'del':
        clear_pending_action(context)
        await render_delete_confirmation(query.message, context, memory_id=memory_id, list_page=value)
        return

    if action == 'delc':
        deleted = store.delete_memory(memory_id)
        clear_pending_action(context)
        await refresh_or_send_memory_list(
            query.message,
            context,
            list_page=value,
            notice=f'Deleted memory from {deleted.date}.',
        )
        await maybe_run_post_update(update)
        return

    await query.message.reply_text('Unknown action.')


def truncate_text(value: str, limit: int = 760) -> str:
    text = ' '.join((value or '').split())
    if not text:
        return '(no description)'
    if len(text) <= limit:
        return text
    return f'{text[: limit - 3].rstrip()}...'


def normalize_list_page(list_page: int, total_items: int) -> int:
    if total_items <= 0:
        return 0
    total_pages = max(1, (total_items + LIST_PAGE_SIZE - 1) // LIST_PAGE_SIZE)
    return max(0, min(list_page, total_pages - 1))


def normalize_memory_index(detail_index: int, total_items: int) -> int:
    if total_items <= 0:
        return 0
    return max(0, min(detail_index, total_items - 1))


def memory_index_to_list_page(detail_index: int) -> int:
    return detail_index // LIST_PAGE_SIZE


def find_memory_index(memories: list[MemoryRecord], memory_id: str) -> int | None:
    for index, memory in enumerate(memories):
        if memory.id == memory_id:
            return index
    return None


def find_list_page_for_memory(memory_id: str, fallback: int = 0) -> int:
    memories = store.list_memories()
    detail_index = find_memory_index(memories, memory_id)
    if detail_index is None:
        return fallback
    return memory_index_to_list_page(detail_index)


def get_memory_media_kind(media_path: Path) -> str:
    suffix = media_path.suffix.lower()
    if suffix in IMAGE_EXTENSIONS:
        return 'photo'
    if suffix in VIDEO_EXTENSIONS:
        return 'video'
    return 'document'


def build_memory_list_view(
    memories: list[MemoryRecord],
    list_page: int,
    notice: str | None = None,
) -> tuple[str, InlineKeyboardMarkup, int]:
    list_page = normalize_list_page(list_page, len(memories))
    start = list_page * LIST_PAGE_SIZE
    page_items = memories[start : start + LIST_PAGE_SIZE]
    total_pages = max(1, (len(memories) + LIST_PAGE_SIZE - 1) // LIST_PAGE_SIZE)

    lines = []
    if notice:
        lines.extend([notice, ''])
    lines.extend(
        [
            f'Memories {start + 1}-{start + len(page_items)} of {len(memories)}',
            'Tap a memory below to open its image or video.',
        ]
    )

    rows: list[list[InlineKeyboardButton]] = []
    for offset, memory in enumerate(page_items, start=start):
        number = offset + 1
        lines.extend(
            [
                '',
                f'{number}. {memory.date}',
                f'   {truncate_text(memory.description, limit=72)}',
            ]
        )
        rows.append(
            [InlineKeyboardButton(f'{number}. {memory.date}', callback_data=f'lo:{list_page}:{memory.id}')]
        )

    nav_row = []
    if list_page > 0:
        nav_row.append(InlineKeyboardButton('Prev', callback_data=f'lp:{list_page - 1}'))
    nav_row.append(InlineKeyboardButton(f'{list_page + 1}/{total_pages}', callback_data=NOOP_CALLBACK))
    if list_page < total_pages - 1:
        nav_row.append(InlineKeyboardButton('Next', callback_data=f'lp:{list_page + 1}'))
    rows.append(nav_row)

    return '\n'.join(lines), InlineKeyboardMarkup(rows), list_page


def build_memory_detail_keyboard(
    memory: MemoryRecord,
    detail_index: int,
    total_items: int,
    list_page: int,
    confirm_delete: bool = False,
) -> InlineKeyboardMarkup:
    navigation_row = []
    if detail_index > 0:
        navigation_row.append(InlineKeyboardButton('Prev', callback_data=f'dv:{detail_index - 1}'))
    navigation_row.append(InlineKeyboardButton(f'{detail_index + 1}/{total_items}', callback_data=NOOP_CALLBACK))
    if detail_index < total_items - 1:
        navigation_row.append(InlineKeyboardButton('Next', callback_data=f'dv:{detail_index + 1}'))

    if confirm_delete:
        rows = [
            navigation_row,
            [InlineKeyboardButton('Confirm delete', callback_data=f'delc:{list_page}:{memory.id}')],
            [InlineKeyboardButton('Cancel', callback_data=f'dv:{detail_index}')],
            [InlineKeyboardButton('Back to list', callback_data=f'lp:{list_page}')],
        ]
    else:
        rows = [
            navigation_row,
            [
                InlineKeyboardButton('Edit caption', callback_data=f'ec:{list_page}:{memory.id}'),
                InlineKeyboardButton('Edit date', callback_data=f'ed:{list_page}:{memory.id}'),
            ],
            [InlineKeyboardButton('Replace media', callback_data=f'em:{list_page}:{memory.id}')],
            [InlineKeyboardButton('Delete', callback_data=f'del:{list_page}:{memory.id}')],
            [InlineKeyboardButton('Back to list', callback_data=f'lp:{list_page}')],
        ]

    return InlineKeyboardMarkup(rows)


def build_memory_detail_view(
    memories: list[MemoryRecord],
    detail_index: int,
    notice: str | None = None,
    confirm_delete: bool = False,
) -> tuple[Path, str, InlineKeyboardMarkup, int, int]:
    detail_index = normalize_memory_index(detail_index, len(memories))
    memory = memories[detail_index]
    list_page = memory_index_to_list_page(detail_index)
    media_path = store.media_dir / memory.image
    caption_lines = []
    if notice:
        caption_lines.append(notice)
        caption_lines.append('')
    caption_lines.extend(
        [
            f'Memory {detail_index + 1} of {len(memories)}',
            f'Date: {memory.date}',
            f'File: {memory.image}',
            '',
            truncate_text(memory.description),
        ]
    )
    if confirm_delete:
        caption_lines.extend(
            [
                '',
                'Delete this memory?',
                'The local media file is also removed if nothing else uses it.',
            ]
        )

    keyboard = build_memory_detail_keyboard(
        memory,
        detail_index,
        total_items=len(memories),
        list_page=list_page,
        confirm_delete=confirm_delete,
    )
    return media_path, '\n'.join(caption_lines), keyboard, detail_index, list_page


def is_media_message(message) -> bool:
    return bool(message.photo or message.video or message.document)


async def send_or_edit_text_browser(
    message,
    text: str,
    reply_markup: InlineKeyboardMarkup | None,
):
    if is_media_message(message):
        return await message.reply_text(text, reply_markup=reply_markup)

    try:
        await message.edit_text(text=text, reply_markup=reply_markup)
        return message
    except BadRequest as exc:
        if 'message is not modified' in str(exc).lower():
            return message
        return await message.reply_text(text, reply_markup=reply_markup)


async def send_or_edit_media_browser(
    message,
    media_path: Path,
    caption: str,
    reply_markup: InlineKeyboardMarkup,
) -> None:
    media_kind = get_memory_media_kind(media_path)
    if not is_media_message(message):
        with media_path.open('rb') as media_handle:
            if media_kind == 'photo':
                return await message.reply_photo(
                    photo=media_handle,
                    caption=caption,
                    reply_markup=reply_markup,
                )
            if media_kind == 'video':
                return await message.reply_video(
                    video=media_handle,
                    caption=caption,
                    reply_markup=reply_markup,
                )
            return await message.reply_document(
                document=media_handle,
                caption=caption,
                reply_markup=reply_markup,
            )

    with media_path.open('rb') as media_handle:
        input_media = None
        if media_kind == 'photo':
            from telegram import InputMediaPhoto

            input_media = InputMediaPhoto(media=media_handle, caption=caption)
        elif media_kind == 'video':
            from telegram import InputMediaVideo

            input_media = InputMediaVideo(media=media_handle, caption=caption)
        else:
            from telegram import InputMediaDocument

            input_media = InputMediaDocument(media=media_handle, caption=caption)

        try:
            await message.edit_media(media=input_media, reply_markup=reply_markup)
            return message
        except BadRequest as exc:
            if 'message is not modified' in str(exc).lower():
                try:
                    await message.edit_caption(caption=caption, reply_markup=reply_markup)
                except BadRequest:
                    pass
                return message
            with media_path.open('rb') as resend_handle:
                if media_kind == 'photo':
                    return await message.reply_photo(
                        photo=resend_handle,
                        caption=caption,
                        reply_markup=reply_markup,
                    )
                if media_kind == 'video':
                    return await message.reply_video(
                        video=resend_handle,
                        caption=caption,
                        reply_markup=reply_markup,
                    )
                return await message.reply_document(
                    document=resend_handle,
                    caption=caption,
                    reply_markup=reply_markup,
                )


async def send_memory_list(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    list_page: int,
    notice: str | None = None,
) -> None:
    memories = store.list_memories()
    if not memories:
        await reply_with_command_menu(message, 'No memories found.')
        return

    text, keyboard, normalized_page = build_memory_list_view(memories, list_page, notice)
    await send_or_edit_text_browser(message, text, keyboard)


async def render_memory_list(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    list_page: int,
    notice: str | None = None,
) -> None:
    memories = store.list_memories()
    if not memories:
        await send_or_edit_text_browser(message, 'No memories found.', None)
        return

    text, keyboard, normalized_page = build_memory_list_view(memories, list_page, notice)
    await send_or_edit_text_browser(message, text, keyboard)


async def render_memory_detail(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    detail_index: int,
    notice: str | None = None,
    confirm_delete: bool = False,
) -> None:
    memories = store.list_memories()
    if not memories:
        await send_or_edit_text_browser(message, 'No memories found.', None)
        return

    media_path, caption, keyboard, normalized_index, list_page = build_memory_detail_view(
        memories,
        detail_index,
        notice,
        confirm_delete=confirm_delete,
    )
    if not media_path.exists():
        await send_or_edit_text_browser(message, f'{caption}\n\nMissing file on disk.', keyboard)
        return

    await send_or_edit_media_browser(message, media_path, caption, keyboard)


async def render_memory_detail_by_id(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    memory_id: str,
    list_page: int | None = None,
    notice: str | None = None,
    confirm_delete: bool = False,
) -> None:
    memories = store.list_memories()
    detail_index = find_memory_index(memories, memory_id)
    if detail_index is None:
        fallback_page = 0 if list_page is None else list_page
        await render_memory_list(message, context, list_page=fallback_page, notice='Memory no longer exists.')
        return

    await render_memory_detail(
        message,
        context,
        detail_index=detail_index,
        notice=notice,
        confirm_delete=confirm_delete,
    )


async def render_delete_confirmation(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    memory_id: str,
    list_page: int,
) -> None:
    memories = store.list_memories()
    detail_index = find_memory_index(memories, memory_id)
    if detail_index is None:
        await render_memory_list(message, context, list_page=list_page, notice='Memory no longer exists.')
        return

    await render_memory_detail(
        message,
        context,
        detail_index=detail_index,
        notice='Delete confirmation',
        confirm_delete=True,
    )


async def refresh_or_send_memory_list(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    list_page: int = 0,
    notice: str | None = None,
) -> None:
    await send_memory_list(message, context, list_page=list_page, notice=notice)


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
    return ApplicationBuilder().token(BOT_TOKEN).post_init(post_init).build()


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
