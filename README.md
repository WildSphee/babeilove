# Our Love Story

A beautiful photo diary to capture and display our memories together.

## Features

- Alternating left/right gallery layout
- Parallax background with animated light streams
- Interactive cursor-reactive image tilt effects
- Lightbox modal with blur backdrop
- Custom handwritten fonts
- Mobile-friendly and touch-optimized

## Quick Start on Linux

```bash
./start.sh
```

Then open http://localhost:5173

## Adding Memories

1. Add your photos to `frontend/public/media/`

2. Edit `frontend/public/media/memories.json`:

```json
[
  {
    "id": 1,
    "image": "our-photo.jpg",
    "date": "2024-01-15",
    "description": "Our first date at the coffee shop"
  },
  {
    "id": 2,
    "image": "vacation.jpg",
    "date": "2024-06-20",
    "description": "Summer vacation by the beach"
  }
]
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
