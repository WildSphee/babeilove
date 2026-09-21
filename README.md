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

Backend files:

- `backend/memory_bot.py` - Telegram bot entrypoint
- `backend/storage.py` - file-backed memory storage and media management
- `pyproject.toml` - Python project and dependency definition
- `poetry.lock` - locked Python dependency versions
- `start_bot.sh` - root runner for the Telegram bot
- `start_dev_fe.sh` - frontend dev runner

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

1. Install Python dependencies:

```bash
poetry install
```

2. Add the bot token to the root `.env`:

```dotenv
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_ALLOWED_USERNAMES=handle1,handle2
POST_UPDATE_COMMAND=./build.sh
```

By default, every successful memory create, edit, reorder, or delete triggers `./build.sh` so the frontend output is rebuilt for nginx. If you need a different deploy flow, override `POST_UPDATE_COMMAND` with another script such as `./update_and_build.sh`.

3. Start the bot:

```bash
./start_bot.sh
```

`start_bot.sh` launches the Telegram bot through `poetry run python -m backend.memory_bot`.

4. Start the frontend dev server separately when needed:

```bash
./start_dev_fe.sh
```

### Video Export Routing

The "Export as Video" button calls `/api/export-video`.

- In local Vite dev, `frontend/vite.config.js` already proxies `/api` to `http://127.0.0.1:5050`
- In production, your web server must proxy `/api/` to the Flask video server

Example nginx location:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5050/api/;
    proxy_read_timeout 600;
}
```

If you do not want to use `/api` on the same origin, set `VITE_API_BASE_URL` for the frontend build so the button calls a different backend base URL.

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
this script automatically git commit / git push and npm run for nginx
perfect for republishing changes after updating the memory
```bash
sh update_and_build.sh
```

Output will be in `frontend/dist/`.
