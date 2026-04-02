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
MEMORY_PAGE_SIZE = 6
NOOP_CALLBACK = 'noop'

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
        '/list - browse memories\n'
        '/new - add a new memory\n'
        '/cancel - clear the current pending action'
    )


@require_authorized
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    await update.effective_message.reply_text('Pending action cleared.')


@require_authorized
async def list_memories(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    clear_pending_action(context)
    memories = store.list_memories()
    if not memories:
        await update.effective_message.reply_text('No memories found.')
        return

    await send_memory_browser(update.effective_message, context, page=0)


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
            page = int(context.user_data.get('browser_page', 0))
            clear_pending_action(context)
            await update.effective_message.reply_text(f'Caption updated for {updated.date}.')
            await refresh_or_send_memory_browser(update.effective_message, context, page=page)
            await maybe_run_post_update(update)
            return

        if action == ACTION_EDIT_DATE:
            pending_id = context.user_data.get('memory_id')
            if not pending_id:
                clear_pending_action(context)
                await update.effective_message.reply_text('The edit session expired. Refresh with /list.')
                return
            updated = store.update_date(pending_id, text)
            page = int(context.user_data.get('browser_page', 0))
            clear_pending_action(context)
            await update.effective_message.reply_text(
                f'Date updated. This memory is now stored under {updated.date}.'
            )
            await refresh_or_send_memory_browser(update.effective_message, context, page=page)
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
            await refresh_or_send_memory_browser(update.effective_message, context, page=0)
            await maybe_run_post_update(update)
            return

        pending_id = context.user_data.get('memory_id')
        if not pending_id:
            clear_pending_action(context)
            await update.effective_message.reply_text('The edit session expired. Refresh with /list.')
            return
        updated = store.replace_media(pending_id, saved_filename)
        page = int(context.user_data.get('browser_page', 0))
        clear_pending_action(context)
        await update.effective_message.reply_text(
            f'Media replaced for {updated.date}. New file: {updated.image}.'
        )
        await refresh_or_send_memory_browser(update.effective_message, context, page=page)
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
    data = query.data or ''
    if data == NOOP_CALLBACK:
        return

    try:
        action, raw_page, *rest = data.split(':')
        page = int(raw_page)
    except (TypeError, ValueError):
        await query.message.reply_text('Invalid action payload.')
        return

    if action == 'page':
        clear_pending_action(context)
        await render_memory_browser(query.message, context, page=page)
        return

    if not rest:
        await query.message.reply_text('Invalid action payload.')
        return

    memory_id = rest[0]
    memory = store.get_memory(memory_id)
    if memory is None:
        clear_pending_action(context)
        await render_memory_browser(query.message, context, page=page, notice='Memory no longer exists.')
        return

    if action == 'mem':
        clear_pending_action(context)
        await render_memory_detail(query.message, context, memory_id, page=page)
        return

    if action == 'ec':
        context.user_data['action'] = ACTION_EDIT_CAPTION
        context.user_data['memory_id'] = memory_id
        context.user_data['browser_page'] = page
        await query.message.reply_text('Send the new caption text.')
        return

    if action == 'ed':
        context.user_data['action'] = ACTION_EDIT_DATE
        context.user_data['memory_id'] = memory_id
        context.user_data['browser_page'] = page
        await query.message.reply_text('Send the new date in YYYY-MM-DD format.')
        return

    if action == 'em':
        context.user_data['action'] = ACTION_EDIT_MEDIA
        context.user_data['memory_id'] = memory_id
        context.user_data['browser_page'] = page
        await query.message.reply_text('Send the replacement photo or video.')
        return

    if action == 'del':
        clear_pending_action(context)
        await render_delete_confirmation(query.message, context, memory_id, page=page)
        return

    if action == 'delc':
        deleted = store.delete_memory(memory_id)
        clear_pending_action(context)
        await render_memory_browser(query.message, context, page=page, notice=f'Deleted memory from {deleted.date}.')
        await maybe_run_post_update(update)
        return

    await query.message.reply_text('Unknown action.')


def shorten_text(value: str, limit: int = 72) -> str:
    text = ' '.join((value or '').split())
    if not text:
        return '(no description)'
    if len(text) <= limit:
        return text
    return f'{text[: limit - 3].rstrip()}...'


def chunk_buttons(
    buttons: list[InlineKeyboardButton], size: int = 1
) -> list[list[InlineKeyboardButton]]:
    return [buttons[index : index + size] for index in range(0, len(buttons), size)]


def normalize_page(page: int, total_items: int) -> int:
    total_pages = max(1, (total_items + MEMORY_PAGE_SIZE - 1) // MEMORY_PAGE_SIZE)
    return max(0, min(page, total_pages - 1))


def remember_browser_message(
    context: ContextTypes.DEFAULT_TYPE, *, chat_id: int, message_id: int, page: int
) -> None:
    context.user_data['browser_chat_id'] = chat_id
    context.user_data['browser_message_id'] = message_id
    context.user_data['browser_page'] = page


def clear_browser_message(context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop('browser_chat_id', None)
    context.user_data.pop('browser_message_id', None)
    context.user_data.pop('browser_page', None)


def build_memory_browser_view(
    memories: list[MemoryRecord], page: int, notice: str | None = None
) -> tuple[str, InlineKeyboardMarkup, int]:
    page = normalize_page(page, len(memories))
    start = page * MEMORY_PAGE_SIZE
    current_items = memories[start : start + MEMORY_PAGE_SIZE]
    total_pages = max(1, (len(memories) + MEMORY_PAGE_SIZE - 1) // MEMORY_PAGE_SIZE)

    lines = []
    if notice:
        lines.append(notice)
        lines.append('')
    lines.extend(
        [
            f'Memories {start + 1}-{start + len(current_items)} of {len(memories)}',
            'Tap a memory below to edit or delete it.',
        ]
    )

    buttons: list[InlineKeyboardButton] = []
    for index, memory in enumerate(current_items, start=start + 1):
        lines.extend(
            [
                '',
                f'{index}. {memory.date}',
                f'   {shorten_text(memory.description)}',
            ]
        )
        buttons.append(
            InlineKeyboardButton(
                f'{index}. {memory.date}',
                callback_data=f'mem:{page}:{memory.id}',
            )
        )

    keyboard_rows = chunk_buttons(buttons, size=1)
    if total_pages > 1:
        nav_row = []
        if page > 0:
            nav_row.append(InlineKeyboardButton('Prev', callback_data=f'page:{page - 1}'))
        nav_row.append(InlineKeyboardButton(f'{page + 1}/{total_pages}', callback_data=NOOP_CALLBACK))
        if page < total_pages - 1:
            nav_row.append(InlineKeyboardButton('Next', callback_data=f'page:{page + 1}'))
        keyboard_rows.append(nav_row)

    return '\n'.join(lines), InlineKeyboardMarkup(keyboard_rows), page


def build_memory_detail_view(
    memories: list[MemoryRecord], memory_id: str, page: int, notice: str | None = None
) -> tuple[str, InlineKeyboardMarkup, int]:
    index = next((offset for offset, memory in enumerate(memories, start=1) if memory.id == memory_id), None)
    if index is None:
        raise KeyError('Memory no longer exists. Refresh with /list.')

    memory = memories[index - 1]
    media_path = store.media_dir / memory.image
    if not media_path.exists():
        media_status = 'missing on disk'
    elif media_path.suffix.lower() in IMAGE_EXTENSIONS:
        media_status = 'image'
    elif media_path.suffix.lower() in VIDEO_EXTENSIONS:
        media_status = 'video'
    else:
        media_status = 'document'

    lines = []
    if notice:
        lines.append(notice)
        lines.append('')
    lines.extend(
        [
            f'Memory {index} of {len(memories)}',
            f'Date: {memory.date}',
            f'File: {memory.image}',
            f'Media: {media_status}',
            '',
            memory.description or '(no description)',
        ]
    )

    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton('Edit caption', callback_data=f'ec:{page}:{memory.id}'),
                InlineKeyboardButton('Edit date', callback_data=f'ed:{page}:{memory.id}'),
            ],
            [InlineKeyboardButton('Replace media', callback_data=f'em:{page}:{memory.id}')],
            [InlineKeyboardButton('Delete', callback_data=f'del:{page}:{memory.id}')],
            [InlineKeyboardButton('Back to list', callback_data=f'page:{page}')],
        ]
    )
    return '\n'.join(lines), keyboard, page


async def edit_browser_message(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    text: str,
    reply_markup: InlineKeyboardMarkup | None,
    page: int,
) -> None:
    try:
        await message.edit_text(text=text, reply_markup=reply_markup)
    except BadRequest as exc:
        if 'message is not modified' not in str(exc).lower():
            raise
    remember_browser_message(
        context,
        chat_id=message.chat_id,
        message_id=message.message_id,
        page=page,
    )


async def send_memory_browser(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    page: int,
    notice: str | None = None,
) -> None:
    memories = store.list_memories()
    if not memories:
        clear_browser_message(context)
        await message.reply_text('No memories found.')
        return

    text, keyboard, normalized_page = build_memory_browser_view(memories, page, notice)
    sent_message = await message.reply_text(text, reply_markup=keyboard)
    remember_browser_message(
        context,
        chat_id=sent_message.chat_id,
        message_id=sent_message.message_id,
        page=normalized_page,
    )


async def render_memory_browser(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    page: int,
    notice: str | None = None,
) -> None:
    memories = store.list_memories()
    if not memories:
        clear_browser_message(context)
        try:
            await message.edit_text(text='No memories found.')
        except BadRequest as exc:
            if 'message is not modified' not in str(exc).lower():
                raise
        return

    text, keyboard, normalized_page = build_memory_browser_view(memories, page, notice)
    await edit_browser_message(message, context, text, keyboard, normalized_page)


async def render_memory_detail(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    memory_id: str,
    page: int,
    notice: str | None = None,
) -> None:
    memories = store.list_memories()
    text, keyboard, normalized_page = build_memory_detail_view(memories, memory_id, page, notice)
    await edit_browser_message(message, context, text, keyboard, normalized_page)


async def render_delete_confirmation(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    memory_id: str,
    page: int,
) -> None:
    memories = store.list_memories()
    memory = next((item for item in memories if item.id == memory_id), None)
    if memory is None:
        await render_memory_browser(message, context, page=page, notice='Memory no longer exists.')
        return

    text, _, normalized_page = build_memory_detail_view(memories, memory_id, page)
    confirmation_text = (
        f'{text}\n\n'
        'Delete this memory? The local media file is also removed if nothing else uses it.'
    )
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton('Confirm delete', callback_data=f'delc:{normalized_page}:{memory.id}')],
            [InlineKeyboardButton('Cancel', callback_data=f'mem:{normalized_page}:{memory.id}')],
        ]
    )
    await edit_browser_message(message, context, confirmation_text, keyboard, normalized_page)


async def refresh_memory_browser(
    context: ContextTypes.DEFAULT_TYPE, page: int | None = None
) -> bool:
    chat_id = context.user_data.get('browser_chat_id')
    message_id = context.user_data.get('browser_message_id')
    if chat_id is None or message_id is None:
        return False

    page_to_use = int(context.user_data.get('browser_page', 0) if page is None else page)
    memories = store.list_memories()
    if not memories:
        try:
            await context.bot.edit_message_text(
                chat_id=chat_id,
                message_id=message_id,
                text='No memories found.',
            )
        except BadRequest:
            clear_browser_message(context)
            return False
        clear_browser_message(context)
        return True

    text, keyboard, normalized_page = build_memory_browser_view(memories, page_to_use)
    try:
        await context.bot.edit_message_text(
            chat_id=chat_id,
            message_id=message_id,
            text=text,
            reply_markup=keyboard,
        )
    except BadRequest as exc:
        if 'message is not modified' not in str(exc).lower():
            clear_browser_message(context)
            return False

    remember_browser_message(
        context,
        chat_id=chat_id,
        message_id=message_id,
        page=normalized_page,
    )
    return True


async def refresh_or_send_memory_browser(
    message,
    context: ContextTypes.DEFAULT_TYPE,
    page: int | None = None,
) -> None:
    if await refresh_memory_browser(context, page=page):
        return
    await send_memory_browser(message, context, page=page or 0)


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
