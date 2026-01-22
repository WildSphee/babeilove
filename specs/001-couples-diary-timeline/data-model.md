# Data Model: Private Couple's Diary & Media Timeline

**Date**: 2026-01-22
**Feature Branch**: `001-couples-diary-timeline`

## Overview

All data is stored in a single JSON file (`data/memories.json`) with media files in the `media/` directory. This model supports the core entities: Memory, Configuration, and implicit User (via authentication).

## Entities

### Memory

Represents a single diary entry with associated media.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Yes | Unique identifier |
| `mediaPath` | string | Yes | Relative path to media file from media/ directory |
| `mediaType` | enum | Yes | `"image"` or `"video"` |
| `mimeType` | string | Yes | MIME type (e.g., `"image/jpeg"`, `"video/mp4"`) |
| `caption` | string | No | User-entered description (can be empty) |
| `date` | string (ISO date) | Yes | Date memory was taken (YYYY-MM-DD) |
| `createdAt` | string (ISO datetime) | Yes | When entry was created |
| `updatedAt` | string (ISO datetime) | Yes | When entry was last modified |
| `fileSize` | number | Yes | File size in bytes |
| `imported` | boolean | No | `true` if auto-imported from existing media |

**Validation Rules**:
- `id`: Valid UUID v4 format
- `mediaPath`: Must exist in media/ directory, no path traversal (`..`)
- `mediaType`: Must be `"image"` or `"video"`
- `mimeType`: Must be one of: `image/jpeg`, `image/png`, `video/mp4`, `video/quicktime`
- `caption`: Max 2000 characters
- `date`: Valid ISO date, not in future
- `fileSize`: Must be ≤ 104857600 (100 MB)

**State Transitions**:
- Created → Updated (caption/date edited)
- Created/Updated → Deleted (removed from timeline, file deleted)

### Configuration

Application-wide settings stored alongside memories.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `relationshipStartDate` | string (ISO date) | No | Start date for "days together" counter |
| `timelineOrder` | enum | Yes | `"newest-first"` (default) or `"oldest-first"` |
| `title` | string | No | Custom title for hero section (default: "Our Story") |
| `subtitle` | string | No | Optional subtitle text |

### User (Implicit)

Users are not stored in the data file. Authentication is handled via environment variables:

| Environment Variable | Description |
|---------------------|-------------|
| `AUTH_USERNAME` | Login username |
| `AUTH_PASSWORD` | Bcrypt-hashed password |
| `SESSION_SECRET` | Secret for signing session cookies |

Both users share the same credentials (single shared account for the couple).

## Storage Schema

### File: `data/memories.json`

```json
{
  "version": 1,
  "config": {
    "relationshipStartDate": "2020-01-15",
    "timelineOrder": "newest-first",
    "title": "Our Story",
    "subtitle": "Every moment with you"
  },
  "memories": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "mediaPath": "unnamed.jpg",
      "mediaType": "image",
      "mimeType": "image/jpeg",
      "caption": "A beautiful day",
      "date": "2026-01-20",
      "createdAt": "2026-01-22T10:30:00Z",
      "updatedAt": "2026-01-22T10:30:00Z",
      "fileSize": 336148,
      "imported": false
    }
  ]
}
```

### Schema Version Migration

The `version` field supports future schema changes:
- Version 1: Initial schema (current)
- Future versions: Migration logic runs on startup if version mismatch

## File Organization

```
project-root/
├── data/
│   └── memories.json      # All memory metadata
├── media/
│   ├── <uuid>.<ext>       # Uploaded files (renamed to UUID)
│   └── <original>.<ext>   # Imported files (keep original names)
```

**File Naming**:
- Uploaded files: Renamed to `<uuid>.<extension>` to prevent collisions
- Imported files: Keep original filename for user familiarity
- All filenames sanitized (no special characters, no path traversal)

## Relationships

```
Configuration (1) ──── contains ───► Memories (many)
     │
     └── Controls display order and hero section content

Memory (1) ──── references ───► Media File (1)
     │
     └── mediaPath points to file in media/ directory
```

## Indexes (In-Memory)

When loaded, the service maintains:
- `memoriesById`: Map<id, Memory> for O(1) lookup
- `memoriesSorted`: Array sorted by date for timeline display

## Backup Strategy

- `memories.json` is the single source of truth
- Copy `data/` and `media/` directories for full backup
- No incremental/differential backup needed at this scale
