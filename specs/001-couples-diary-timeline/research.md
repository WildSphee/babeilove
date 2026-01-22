# Research: Private Couple's Diary & Media Timeline

**Date**: 2026-01-22
**Feature Branch**: `001-couples-diary-timeline`

## Technology Decisions

### 1. Backend Framework

**Decision**: Express.js on Node.js 20 LTS

**Rationale**:
- Mature, well-documented, minimal learning curve
- Excellent file handling and streaming support for large media files
- Native JSON support aligns with file-based storage requirement
- Large ecosystem for middleware (sessions, file uploads, CORS)

**Alternatives Considered**:
- Fastify: Slightly faster but less ecosystem support, overkill for 2 users
- Hono: Modern but newer, less documentation for file handling
- Python/Flask: Good but adds language complexity to project

### 2. Frontend Approach

**Decision**: Vanilla JavaScript with ES6 modules + CSS

**Rationale**:
- No build step required (simplicity)
- Modern browsers support ES6 modules natively
- Direct DOM manipulation sufficient for this UI complexity
- Smaller bundle size, faster initial load
- CSS custom properties for dynamic theming/backgrounds

**Alternatives Considered**:
- React: Adds complexity, build tooling, larger bundle for simple app
- Vue: Same concerns as React
- Svelte: Better but still requires build step
- HTMX: Good for server-rendered but less suitable for smooth SPA experience

### 3. File Upload Handling

**Decision**: Multer middleware with disk storage

**Rationale**:
- Standard Express middleware for multipart form data
- Supports file size limits (100MB max)
- Streaming to disk prevents memory issues with large videos
- Configurable filename generation

**Best Practices**:
- Validate MIME types server-side (not just extension)
- Generate unique filenames to prevent collisions
- Stream files rather than loading into memory
- Return upload progress for large files

### 4. Real-time Updates

**Decision**: Server-Sent Events (SSE)

**Rationale**:
- Simpler than WebSockets for one-way server-to-client updates
- Native browser support, no library needed
- Automatic reconnection built-in
- Sufficient for "new memory added" notifications

**Alternatives Considered**:
- WebSockets: Bidirectional overkill, more complex
- Polling: Works but less efficient, potential delays
- Long polling: Complexity without benefit over SSE

### 5. Session Authentication

**Decision**: express-session with cookie-based sessions

**Rationale**:
- Simple username/password stored in .env
- No user registration needed (hardcoded 2 users)
- Session stored in memory (acceptable for 2 users)
- Secure cookies with httpOnly flag

**Configuration**:
```
AUTH_USERNAME=<username>
AUTH_PASSWORD=<hashed_password>
SESSION_SECRET=<random_secret>
```

**Best Practices**:
- Hash password with bcrypt before comparing
- Use secure cookies in production (HTTPS)
- Set reasonable session expiry (7 days for remember-me feel)
- CSRF protection for state-changing requests

### 6. JSON File Storage

**Decision**: Single `data/memories.json` file with atomic writes

**Rationale**:
- Meets "no database" requirement
- Simple to backup (copy file)
- Human-readable for debugging
- Sufficient for expected data volume (<1000 memories)

**Best Practices**:
- Write to temp file, then rename (atomic operation)
- Keep file locked during writes to prevent corruption
- Load into memory on startup, write on changes
- Include schema version for future migrations

**Data Structure**:
```json
{
  "version": 1,
  "config": {
    "relationshipStartDate": "2020-01-15",
    "timelineOrder": "newest-first"
  },
  "memories": [
    {
      "id": "uuid",
      "mediaPath": "relative/path.jpg",
      "mediaType": "image",
      "caption": "Our first date",
      "date": "2020-01-15",
      "createdAt": "2026-01-22T10:00:00Z",
      "updatedAt": "2026-01-22T10:00:00Z"
    }
  ]
}
```

### 7. Media Serving

**Decision**: Express static middleware with lazy loading support

**Rationale**:
- Simple configuration for serving media directory
- Range request support for video streaming
- Cache headers for performance

**Best Practices**:
- Enable gzip for text, skip for already-compressed media
- Set appropriate cache headers (1 year for immutable media)
- Support Range headers for video seeking
- Generate thumbnails for video preview (optional optimization)

### 8. Dynamic Background Implementation

**Decision**: CSS custom properties + scroll-linked animations

**Rationale**:
- GPU-accelerated CSS transforms
- No JavaScript animation loops (better performance)
- CSS `scroll-timeline` for scroll-linked effects (with fallback)
- Respects `prefers-reduced-motion` media query

**Techniques**:
- Gradient backgrounds using CSS custom properties
- Parallax via `transform: translateY()` based on scroll
- Intersection Observer for triggering animations
- `will-change` hints for compositor optimization

### 9. Lazy Loading Strategy

**Decision**: Intersection Observer API + native `loading="lazy"`

**Rationale**:
- Native browser support, no library needed
- Configurable root margin for preloading
- Works with both images and video posters

**Implementation**:
- Use `loading="lazy"` on img elements
- Intersection Observer for video elements and custom logic
- Load ~2 viewport heights ahead for smooth scrolling
- Placeholder/skeleton while loading

### 10. Import Existing Media

**Decision**: Scan media directory on startup, create entries for unknowns

**Rationale**:
- User has existing media files in `media/` folder
- One-time import creates metadata entries
- Extract date from EXIF if available, otherwise use file mtime

**Process**:
1. On startup, scan `media/` directory
2. Compare against memories.json
3. For unknown files: create entry with placeholder caption, extracted/file date
4. Mark as "needs caption" for user to fill in later

## Edge Case Resolutions

### Corrupted/Unreadable Media Files
- Display placeholder image with error message
- Log error for debugging
- Allow user to remove entry

### Offline Upload Behavior
- Show clear error when network unavailable
- No offline queue (simplicity) - user retries manually

### Concurrent Edit Conflicts
- Last write wins (acceptable for 2 users who coordinate)
- No locking mechanism needed for personal use

### Missing Date Metadata
- Use file modification time as fallback
- Allow manual date entry/correction
- Sort by createdAt if date is missing

## Security Considerations

- All routes except login require authentication
- Password hashed with bcrypt (cost factor 10)
- Session cookie httpOnly, sameSite strict
- File upload validates MIME type, not just extension
- No path traversal in media URLs (sanitize filenames)
- .env excluded from git, contains all secrets
