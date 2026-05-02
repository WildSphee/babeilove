# Our Love Story

A beautiful photo diary to capture and display our memories together.

The frontend stays static. A separate Python Telegram bot can now manage the memories by editing files directly in `frontend/public/media/`.

## Features

- Alternating left/right gallery layout
- Parallax background with animated light streams
- Interactive cursor-reactive image tilt effects
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

- `frontend/public/media/memories.json`
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
- `/new` creates a new memory by asking for the date, description, and media upload
- Edit actions support caption, date, and media replacement
- Delete removes the memory entry and deletes the local media file when no other entry uses it
- The bot shows a persistent reply keyboard with `🗂 List Memories` and `➕ New Memory`
- `/cancel` clears the current pending edit or creation flow

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
TELEGRAM_ALLOWED_USERNAMES=reagan_c,audikor
POST_UPDATE_COMMAND=./build.sh
```

By default, every successful memory create, edit, or delete triggers `./build.sh` so the frontend output is rebuilt for nginx. If you need a different deploy flow, override `POST_UPDATE_COMMAND` with another script such as `./update_and_build.sh`.

3. Start the bot:

```bash
./start_bot.sh
```

`start_bot.sh` launches the Telegram bot through `poetry run python -m backend.memory_bot`.

4. Start the frontend dev server separately when needed:

```bash
./start_dev_fe.sh
```

### Bot Usage

1. Send `/list` or tap `🗂 List Memories` to open the paginated memory overview
2. Tap a memory row to open its image or video inside the bot
3. Use the inline buttons to edit caption, date, replace media, or delete the current memory
4. Send `/new` to create a new memory, then follow the prompts

## Adding Memories

1. Add your photos to `frontend/public/media/`

2. Edit `frontend/public/media/memories.json`:

```json
{
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
}
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
