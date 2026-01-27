# babeilove Development Guidelines

Last updated: 2026-01-27

## Overview

A couples photo diary/timeline - a beautiful React gallery to display memories with custom handwritten fonts and interactive animations.

## Technologies

- React 18 + Vite (frontend)
- Custom fonts: Lonely Study, Loverine, Papernotes

## Project Structure

```text
frontend/
├── public/
│   ├── fonts/          # Custom font files
│   └── media/
│       ├── memories.json   # Memory data (image, date, description)
│       └── *.jpg/*.mov     # Media files
├── src/
│   ├── components/
│   │   ├── Gallery.jsx     # Photo gallery with alternating layout
│   │   └── Lightbox.jsx    # Modal viewer
│   ├── App.jsx             # Main app with parallax background
│   ├── App.css             # Styles + animations
│   ├── fonts.css           # @font-face definitions
│   └── main.jsx            # Entry point
└── index.html
start.sh                    # Run script
```

## Commands

```bash
# Run development server
./start.sh
# or
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Lint
cd frontend && npm run lint
```

## Adding Memories

Edit `frontend/public/media/memories.json`:

```json
[
  {
    "id": 1,
    "image": "photo.jpg",
    "date": "2024-01-15",
    "description": "Your caption here"
  }
]
```

Place images in `frontend/public/media/`.

## Code Style

- React functional components with hooks
- CSS modules per component
- Mobile-first responsive design

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
