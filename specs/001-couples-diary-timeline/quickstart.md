# Quickstart: Private Couple's Diary & Media Timeline

## Prerequisites

- Node.js 20 LTS or later
- npm (comes with Node.js)

## Setup

### 1. Clone and Install

```bash
cd babeilove
npm install
```

### 2. Configure Environment

Edit `.env` file with your credentials:

```env
# Authentication
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_bcrypt_hashed_password
SESSION_SECRET=your_random_secret_string

# Optional: Port configuration
PORT=3000
```

**Generate a password hash:**

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10).then(h => console.log(h));"
```

**Generate a session secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

### 3. Initialize Data

Create the data directory and initial memories file:

```bash
mkdir -p data
echo '{"version":1,"config":{"timelineOrder":"newest-first","title":"Our Story"},"memories":[]}' > data/memories.json
```

### 4. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The application will be available at `http://localhost:3000`

## Directory Structure

```
babeilove/
├── backend/           # Express API server
├── frontend/          # Static frontend files
├── data/
│   └── memories.json  # Memory metadata
├── media/             # Media files (photos/videos)
├── .env               # Credentials (not in git)
└── package.json
```

## First Run

1. Open `http://localhost:3000` in your browser
2. Log in with your configured credentials
3. Your existing media files in `media/` will be imported automatically
4. Add captions and dates to imported memories
5. Upload new memories via the upload page

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/timeline` | Get memories + config |
| POST | `/api/memories` | Upload new memory |
| PATCH | `/api/memories/:id` | Edit memory |
| DELETE | `/api/memories/:id` | Delete memory |
| GET | `/api/events` | Real-time updates (SSE) |

See `specs/001-couples-diary-timeline/contracts/api.yaml` for full API documentation.

## Common Tasks

### Add Authentication Credentials

1. Generate password hash (see above)
2. Add to `.env`:
   ```
   AUTH_USERNAME=myuser
   AUTH_PASSWORD=$2b$10$...hashed...
   ```
3. Restart server

### Backup Data

```bash
# Backup everything
cp -r data/ backup/data/
cp -r media/ backup/media/

# Restore
cp -r backup/data/* data/
cp -r backup/media/* media/
```

### Import Existing Photos

Place media files in the `media/` directory. On next server start, they will be automatically imported with:
- Date extracted from EXIF (if available) or file modification time
- Empty caption (edit later via the app)

## Troubleshooting

### "Unauthorized" error
- Check your credentials in `.env`
- Ensure password is bcrypt-hashed (starts with `$2b$`)
- Clear browser cookies and try again

### Media not loading
- Check file permissions on `media/` directory
- Verify supported formats: JPEG, PNG, MP4, MOV
- Check file size (max 100MB)

### Changes not appearing
- Check browser console for errors
- Verify `data/memories.json` is writable
- Restart server if needed
