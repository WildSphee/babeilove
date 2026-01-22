# Implementation Plan: Private Couple's Diary & Media Timeline

**Branch**: `001-couples-diary-timeline` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-couples-diary-timeline/spec.md`

## Summary

Build a private, shared digital diary web application for a couple that combines written memories with photos and videos in a visually immersive, scrollable timeline. The application emphasizes emotional storytelling through dynamic backgrounds, lazy-loaded media, and real-time updates when new memories are added. Authentication ensures only the couple can access content. All metadata is stored in JSON files (no database), and credentials are managed via environment variables.

## Technical Context

**Language/Version**: Node.js 20 LTS (backend), Modern JavaScript/ES6+ (frontend)
**Primary Dependencies**: Express.js (server), Vanilla JS + CSS (frontend for simplicity and performance)
**Storage**: JSON file for memory metadata (`data/memories.json`), file system for media (`media/`)
**Testing**: Jest (unit tests), Supertest (API integration tests)
**Target Platform**: Web (modern browsers - Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: Initial load <3s, smooth 60fps scrolling, lazy media loading
**Constraints**: Max 100MB file uploads, supports 1,000+ memories, no database dependency
**Scale/Scope**: 2 users (couple), personal use, low concurrency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution template has not been customized for this project. Proceeding with standard best practices:

- [x] **Simplicity**: No database, JSON file storage aligns with YAGNI principles
- [x] **Security**: Authentication required, credentials in .env (not in repo)
- [x] **Testability**: API endpoints testable, frontend components isolatable
- [x] **Maintainability**: Clear separation of concerns (backend API, frontend UI, data storage)

## Project Structure

### Documentation (this feature)

```text
specs/001-couples-diary-timeline/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── index.js           # Express app entry point
│   ├── routes/
│   │   ├── auth.js        # Login/logout endpoints
│   │   ├── memories.js    # CRUD for memories
│   │   └── media.js       # File upload/serve endpoints
│   ├── middleware/
│   │   └── auth.js        # Session authentication
│   ├── services/
│   │   ├── memories.js    # Memory business logic
│   │   └── storage.js     # JSON file read/write
│   └── config.js          # Environment config loader
├── tests/
│   ├── unit/
│   └── integration/
└── package.json

frontend/
├── src/
│   ├── index.html         # Main HTML entry
│   ├── css/
│   │   ├── main.css       # Core styles
│   │   ├── timeline.css   # Timeline-specific styles
│   │   └── animations.css # Dynamic background, transitions
│   ├── js/
│   │   ├── app.js         # Main application logic
│   │   ├── timeline.js    # Timeline rendering & scroll
│   │   ├── viewer.js      # Full-screen media viewer
│   │   ├── upload.js      # Upload form handling
│   │   ├── auth.js        # Login/logout handling
│   │   └── api.js         # Backend API client
│   └── assets/            # Static assets (icons, fonts)
└── tests/

data/
└── memories.json          # Memory metadata storage

media/                     # Media files (existing + uploaded)
├── sticker2.mov
├── sticker3.mov
├── stickerwalpha.mov
└── unnamed.jpg

.env                       # Credentials (AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET)
.gitignore                 # Excludes .env, node_modules, etc.
```

**Structure Decision**: Web application structure with separate backend (Express API) and frontend (vanilla JS SPA). This keeps the stack simple while providing clear separation. No build tools required for frontend (modern browsers support ES6 modules natively).

## Complexity Tracking

No violations - the design follows simplicity principles:
- No database (JSON file storage)
- No frontend framework (vanilla JS)
- No build tooling (native ES6 modules)
- Simple session-based auth (no OAuth complexity)
