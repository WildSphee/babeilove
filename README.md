# Our Love Story

A beautiful photo diary to capture and display our memories together.

The frontend stays static. A separate Python Telegram bot can now manage the memories by editing files directly in `frontend/public/media/`.

## Features

- Alternating left/right gallery layout
- Parallax background with animated light streams
- Lightbox modal with blur backdrop
- Custom handwritten fonts
- Mobile-friendly and touch-optimized

## Quick Start on Linux

```bash
./start_dev_fe.sh
```

This starts the Vite frontend at `http://localhost:5234`.

## Telegram Backend

The bot uses polling and writes directly to:

- `frontend/public/media/memories.js`
- `frontend/public/media/*`

Project files and scripts:

- `backend/memory_bot.py` - Telegram bot entrypoint
- `backend/storage.py` - file-backed memory storage and media management
- `backend/media_dates.py` - photo date metadata and Telegram date validation
- `pyproject.toml` - Python project and dependency definition
- `poetry.lock` - locked Python dependency versions
- `start_bot.sh` - root runner for the Telegram bot
- `start_dev_fe.sh` - frontend dev runner
- `build.sh` - frontend production build
- `tests/test_memory_features.py` - offline bot and storage tests

Supported bot flows:

- `/list` opens a paginated overview list in one Telegram message
- Selecting a memory from the list opens its image or video with inline edit controls
- `/new` asks for a photo or video first, then its date, and finally a description
- When a photo has readable EXIF date metadata, the bot suggests it with a `Yes use this date` inline button; you can type a different date instead
- Enter dates as six digits in `ddmmyy` format (for example, `210926` means 21 September 2026; two-digit years mean 2000–2099). Stored dates remain `YYYY-MM-DD`
- Future dates and dates more than one calendar year before the server's current date require an extra confirmation, including when editing dates
- Photos without readable date metadata and videos prompt for a date manually. Sending the original photo as a file helps preserve its metadata
- Edit actions support caption, date, and media replacement
- Open a memory and tap `Set as first picture for this day` to move it ahead of the other memories on that date in `memories.js`. The website uses this order for its day cover and browsing order; later additions and edits preserve the order within each day
- Delete removes the memory entry and deletes the local media file when no other entry uses it
- The bot shows a persistent reply keyboard with `🗂 List Memories` and `➕ New Memory`
- `/cancel` clears the current pending edit or creation flow and removes any uncommitted upload

Access is restricted to Telegram usernames in `TELEGRAM_ALLOWED_USERNAMES`


If anyone else messages the bot, it replies with:

```text
sorry, you don't have access to this Telegram chatbot
```

### Backend Setup

1. Install Python 3.12 or newer with its matching `venv` package, then prepare the bot environment:

```bash
./start_bot.sh --setup
```

This creates `./venv` and installs the dependencies from `pyproject.toml`. If Poetry is already available, it uses `poetry install --no-root` instead. Setup does not start the bot.

2. Add the bot token to the root `.env`:

```dotenv
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ALLOWED_USERNAMES=handle1,handle2
POST_UPDATE_COMMAND=./build.sh
```

By default, every successful memory create, edit, reorder, or delete triggers `./build.sh` so the frontend output is rebuilt for nginx. Set `POST_UPDATE_COMMAND` to a custom command if your deployment needs a different build step.

3. Start the bot:

```bash
./start_bot.sh
```

`start_bot.sh` uses `./venv/bin/python` or Poetry to launch the bot. If neither exists, it creates the environment and installs dependencies automatically before launching.

4. Start the frontend dev server separately when needed:

```bash
./start_dev_fe.sh
```

### Bot Usage

1. Send `/list` or tap `🗂 List Memories` to open the paginated memory overview
2. Tap a memory row to open its image or video inside the bot
3. Use the inline buttons to edit caption, date, replace media, set the first picture for that day, or delete the current memory
4. Send `/new` to create a new memory, then follow the prompts

### Offline Tests

```bash
poetry run python -m unittest discover -s tests -v
```

The tests use temporary memory files and mocked Telegram messages and rebuild commands. They do not start polling, contact Telegram, rebuild the site, or modify real memories.

## Adding Memories

1. Add your photos to `frontend/public/media/`

2. Edit `frontend/public/media/memories.js`:

```js
export default {
  "config": {
    "title": "Our Love Story"
  },
  "memories": [
    {
      "image": "our-photo.jpg",
      "date": "2024-01-15",
      "description": "Our first date at the coffee shop"
    },
    {
      "image": "vacation.jpg",
      "date": "2024-06-20",
      "description": "Summer vacation by the beach"
    }
  ]
};
```

## Fonts

- **Lonely Study** - Main title
- **Papernotes** - Descriptions
- **Loverine** - Footer note

## Build for Production

Install frontend dependencies once with `npm ci --prefix frontend`, then build:

```bash
./build.sh
```

Serve the static output in `frontend/dist/` with nginx or another static web server. Photo and video playback uses files in `media/`; no HTTP backend is required by the website.
