# Tasks: Private Couple's Diary & Media Timeline

**Input**: Design documents from `/specs/001-couples-diary-timeline/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.yaml, research.md

**Tests**: Not explicitly requested - implementation tasks only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`
- Based on plan.md project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure per implementation plan (backend/, frontend/, data/)
- [ ] T002 Initialize backend Node.js project with package.json in backend/
- [ ] T003 [P] Install backend dependencies (express, express-session, multer, bcrypt, uuid, cors) in backend/
- [ ] T004 [P] Create frontend directory structure (src/css/, src/js/, src/assets/) in frontend/
- [ ] T005 [P] Create initial data/memories.json with empty schema
- [ ] T006 Update .env with AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET placeholders

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create environment config loader in backend/src/config.js
- [ ] T008 [P] Implement JSON storage service with atomic writes in backend/src/services/storage.js
- [ ] T009 [P] Create Express app entry point with middleware setup in backend/src/index.js
- [ ] T010 Implement session-based auth middleware in backend/src/middleware/auth.js
- [ ] T011 Create auth routes (login, logout, status) in backend/src/routes/auth.js
- [ ] T012 [P] Create base HTML template with ES6 module support in frontend/src/index.html
- [ ] T013 [P] Create API client module in frontend/src/js/api.js
- [ ] T014 [P] Create main CSS with CSS variables for theming in frontend/src/css/main.css
- [ ] T015 Configure static file serving and API proxy in backend/src/index.js

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Browse Memory Timeline (Priority: P1) 🎯 MVP

**Goal**: Display scrollable timeline with memories, hero section, dynamic backgrounds, and lazy loading

**Independent Test**: Load main page, scroll through memories, verify media/captions display correctly with smooth scrolling and dynamic background effects

### Implementation for User Story 1

- [ ] T016 [US1] Implement memories service with CRUD operations in backend/src/services/memories.js
- [ ] T017 [US1] Create timeline API route (GET /api/timeline) in backend/src/routes/memories.js
- [ ] T018 [US1] Create media serving route with range support in backend/src/routes/media.js
- [ ] T019 [P] [US1] Create timeline rendering module in frontend/src/js/timeline.js
- [ ] T020 [P] [US1] Create timeline-specific styles in frontend/src/css/timeline.css
- [ ] T021 [P] [US1] Create dynamic background and animation styles in frontend/src/css/animations.css
- [ ] T022 [US1] Implement hero section with counters (days together, memory count) in frontend/src/js/timeline.js
- [ ] T023 [US1] Implement lazy loading with Intersection Observer in frontend/src/js/timeline.js
- [ ] T024 [US1] Implement scroll-linked background transitions in frontend/src/js/timeline.js
- [ ] T025 [US1] Add reduced-motion media query support in frontend/src/css/animations.css
- [ ] T026 [US1] Implement empty timeline state with welcome message in frontend/src/js/timeline.js
- [ ] T027 [US1] Create main app entry point integrating auth and timeline in frontend/src/js/app.js

**Checkpoint**: User Story 1 complete - timeline browsing fully functional

---

## Phase 4: User Story 2 - Upload New Memories (Priority: P2)

**Goal**: Upload photos/videos with captions and dates, real-time timeline updates

**Independent Test**: Navigate to upload page, select media file, enter caption and date, submit, verify memory appears in timeline without refresh

### Implementation for User Story 2

- [ ] T028 [US2] Create memory upload route (POST /api/memories) with multer in backend/src/routes/memories.js
- [ ] T029 [US2] Add file validation (type, size 100MB limit) in backend/src/routes/memories.js
- [ ] T030 [US2] Implement SSE endpoint for real-time updates (GET /api/events) in backend/src/routes/memories.js
- [ ] T031 [P] [US2] Create upload form UI in frontend/src/js/upload.js
- [ ] T032 [P] [US2] Add upload form styles in frontend/src/css/main.css
- [ ] T033 [US2] Implement file preview before upload in frontend/src/js/upload.js
- [ ] T034 [US2] Add upload progress indicator in frontend/src/js/upload.js
- [ ] T035 [US2] Implement success/error feedback UI in frontend/src/js/upload.js
- [ ] T036 [US2] Implement SSE client for real-time timeline updates in frontend/src/js/api.js
- [ ] T037 [US2] Connect SSE to timeline for auto-refresh in frontend/src/js/timeline.js

**Checkpoint**: User Story 2 complete - upload and real-time updates functional

---

## Phase 5: User Story 3 - View Media in Full Screen (Priority: P3)

**Goal**: Full-screen/modal viewer for images and videos with navigation

**Independent Test**: Click on timeline memory, verify full-screen viewer opens with media, caption, date, and next/previous navigation

### Implementation for User Story 3

- [ ] T038 [P] [US3] Create viewer modal component in frontend/src/js/viewer.js
- [ ] T039 [P] [US3] Add viewer modal styles in frontend/src/css/main.css
- [ ] T040 [US3] Implement image zoom functionality in frontend/src/js/viewer.js
- [ ] T041 [US3] Implement video player with controls in frontend/src/js/viewer.js
- [ ] T042 [US3] Add caption and date display in viewer in frontend/src/js/viewer.js
- [ ] T043 [US3] Implement next/previous navigation in frontend/src/js/viewer.js
- [ ] T044 [US3] Add keyboard navigation (arrows, escape) in frontend/src/js/viewer.js
- [ ] T045 [US3] Connect viewer to timeline click events in frontend/src/js/timeline.js

**Checkpoint**: User Story 3 complete - full-screen viewing functional

---

## Phase 6: User Story 4 - Authenticate and Access Control (Priority: P4)

**Goal**: Login page, session management, route protection

**Independent Test**: Access timeline without auth (redirected to login), login with valid credentials (access granted), logout (access revoked)

### Implementation for User Story 4

- [ ] T046 [P] [US4] Create login page UI in frontend/src/js/auth.js
- [ ] T047 [P] [US4] Add login page styles in frontend/src/css/main.css
- [ ] T048 [US4] Implement login form submission in frontend/src/js/auth.js
- [ ] T049 [US4] Add logout button to main page in frontend/src/js/app.js
- [ ] T050 [US4] Implement auth state management in frontend/src/js/auth.js
- [ ] T051 [US4] Add route protection (redirect to login if not authenticated) in frontend/src/js/app.js
- [ ] T052 [US4] Add password hashing utility script for .env setup in backend/src/scripts/hash-password.js

**Checkpoint**: User Story 4 complete - authentication fully functional

---

## Phase 7: User Story 5 - Edit and Remove Memories (Priority: P5)

**Goal**: Edit memory captions/dates, delete memories with file cleanup

**Independent Test**: Edit a memory's caption, save, verify changes persist; delete a memory, verify it's removed from timeline and file is deleted

### Implementation for User Story 5

- [ ] T053 [US5] Create memory update route (PATCH /api/memories/:id) in backend/src/routes/memories.js
- [ ] T054 [US5] Create memory delete route (DELETE /api/memories/:id) with file cleanup in backend/src/routes/memories.js
- [ ] T055 [US5] Add edit mode UI to memory cards in frontend/src/js/timeline.js
- [ ] T056 [US5] Implement inline edit form for caption and date in frontend/src/js/timeline.js
- [ ] T057 [US5] Add delete confirmation dialog in frontend/src/js/timeline.js
- [ ] T058 [US5] Connect edit/delete to API and update UI in frontend/src/js/timeline.js
- [ ] T059 [US5] Broadcast delete/update events via SSE in backend/src/routes/memories.js

**Checkpoint**: User Story 5 complete - edit and delete functional

---

## Phase 8: User Story 6 - Import Existing Media (Priority: P6)

**Goal**: Auto-import existing media files on startup with placeholder metadata

**Independent Test**: Place media files in media/ directory, start server, verify they appear in timeline with extracted dates

### Implementation for User Story 6

- [ ] T060 [US6] Create media import service in backend/src/services/import.js
- [ ] T061 [US6] Implement file scanning for supported formats in backend/src/services/import.js
- [ ] T062 [US6] Extract date from EXIF metadata (images) in backend/src/services/import.js
- [ ] T063 [US6] Use file mtime as fallback date in backend/src/services/import.js
- [ ] T064 [US6] Create memory entries for imported files in backend/src/services/import.js
- [ ] T065 [US6] Call import service on server startup in backend/src/index.js
- [ ] T066 [US6] Mark imported memories with imported: true flag in backend/src/services/import.js

**Checkpoint**: User Story 6 complete - existing media import functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T067 [P] Add config API routes (GET/PATCH /api/config) in backend/src/routes/memories.js
- [ ] T068 [P] Add error handling middleware in backend/src/index.js
- [ ] T069 [P] Add request logging middleware in backend/src/index.js
- [ ] T070 Add mobile-responsive styles in frontend/src/css/main.css
- [ ] T071 Add loading states and skeletons in frontend/src/css/main.css
- [ ] T072 Test with existing media files in media/ directory
- [ ] T073 Run quickstart.md validation - verify all setup steps work
- [ ] T074 Final testing of all user stories end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - Can proceed sequentially in priority order (P1 → P2 → ... → P6)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 (needs timeline to display uploads)
- **User Story 3 (P3)**: Can start after US1 (needs timeline items to click)
- **User Story 4 (P4)**: Can start after Foundational - No dependencies on other stories
- **User Story 5 (P5)**: Can start after US1 (needs memories to edit/delete)
- **User Story 6 (P6)**: Can start after US1 (needs timeline to display imported media)

### Parallel Opportunities

- T003, T004, T005 can run in parallel (Setup phase)
- T008, T009, T012, T013, T014 can run in parallel (Foundational phase)
- T019, T020, T021 can run in parallel (US1 frontend files)
- T031, T032 can run in parallel (US2 frontend files)
- T038, T039 can run in parallel (US3 frontend files)
- T046, T047 can run in parallel (US4 frontend files)
- T067, T068, T069 can run in parallel (Polish phase)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test timeline browsing independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → MVP: Browse timeline
3. Add User Story 2 → Can add new memories
4. Add User Story 3 → Full-screen viewing
5. Add User Story 4 → Proper authentication
6. Add User Story 5 → Edit/delete memories
7. Add User Story 6 → Import existing media
8. Polish → Production ready

---

## Task Summary

| Phase | Tasks | Parallel Tasks |
|-------|-------|----------------|
| Phase 1: Setup | 6 | 3 |
| Phase 2: Foundational | 9 | 5 |
| Phase 3: US1 - Timeline | 12 | 3 |
| Phase 4: US2 - Upload | 10 | 2 |
| Phase 5: US3 - Viewer | 8 | 2 |
| Phase 6: US4 - Auth | 7 | 2 |
| Phase 7: US5 - Edit/Delete | 7 | 0 |
| Phase 8: US6 - Import | 7 | 0 |
| Phase 9: Polish | 8 | 3 |
| **Total** | **74** | **20** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Credentials stored in .env (AUTH_USERNAME, AUTH_PASSWORD, SESSION_SECRET)
