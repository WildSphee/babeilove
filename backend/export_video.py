#!/usr/bin/env python3
"""Export memories as a beautiful video slideshow.

Generates a 1920×1080 MP4 with:
  - Ken Burns (slow zoom-in) per clip
  - Gradient caption bar with description + date
  - Smooth xfade crossfade transitions between clips
  - Fade-in at start, fade-out at end

Usage (standalone):
    poetry run python -m backend.export_video

Output:
    frontend/public/media/memories_video.mp4
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).parent.parent
MEDIA_DIR = REPO_ROOT / "frontend" / "public" / "media"
FONTS_DIR = REPO_ROOT / "frontend" / "public" / "fonts"
DEFAULT_OUTPUT = MEDIA_DIR / "memories_video.mp4"

FPS = 24
CLIP_DURATION = 5       # seconds per memory
FADE_DURATION = 0.5     # crossfade duration between clips
STEP = CLIP_DURATION - FADE_DURATION  # 4.5 seconds of non-overlapping time per clip
WIDTH, HEIGHT = 1920, 1080

VIDEO_EXTS = {".mp4", ".mov", ".webm", ".ogg", ".m4v"}


# ─── Data helpers ────────────────────────────────────────────────────────────

def load_memories() -> dict:
    with open(MEDIA_DIR / "memories.json") as f:
        return json.load(f)


def format_date(date_str: str) -> str:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%B %d, %Y")
    except ValueError:
        return date_str


# ─── Font loading ─────────────────────────────────────────────────────────────

def _load_font(candidates: list[Path], size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except Exception:
                continue
    return ImageFont.load_default()


def desc_font(size: int = 54) -> ImageFont.FreeTypeFont:
    return _load_font(
        [
            FONTS_DIR / "Papernotes Bold.ttf",
            FONTS_DIR / "Papernotes.ttf",
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
        ],
        size,
    )


def date_font(size: int = 34) -> ImageFont.FreeTypeFont:
    return _load_font(
        [
            FONTS_DIR / "Papernotes.ttf",
            Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
            Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
        ],
        size,
    )


# ─── Caption PNG creation ─────────────────────────────────────────────────────

def create_caption_png(description: str, date_str: str, output_path: Path) -> None:
    """Render a 1920×1080 RGBA PNG: gradient overlay + description + date."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Smooth gradient overlay at the bottom 320px: transparent → near-black
    overlay_h = 320
    for y in range(overlay_h):
        t = y / overlay_h
        ease = t * t * (3.0 - 2.0 * t)          # smoothstep
        alpha = int(215 * ease)
        y_pos = HEIGHT - overlay_h + y
        draw.line([(0, y_pos), (WIDTH - 1, y_pos)], fill=(8, 4, 20, alpha))

    df = desc_font(54)
    dtf = date_font(34)

    # Wrap long descriptions so they fit across 1920px
    wrapped = textwrap.fill(description, width=44)

    # Description — soft drop-shadow then white text, vertically centered in overlay
    desc_y = HEIGHT - 145
    draw.multiline_text(
        (WIDTH // 2 + 2, desc_y + 2), wrapped,
        font=df, fill=(0, 0, 0, 115),
        anchor="mm", align="center",
    )
    draw.multiline_text(
        (WIDTH // 2, desc_y), wrapped,
        font=df, fill=(255, 255, 255, 238),
        anchor="mm", align="center",
    )

    # Date — soft lilac, below description
    date_y = HEIGHT - 58
    formatted = format_date(date_str)
    draw.text((WIDTH // 2 + 1, date_y + 1), formatted,
              font=dtf, fill=(0, 0, 0, 100), anchor="mm")
    draw.text((WIDTH // 2, date_y), formatted,
              font=dtf, fill=(210, 165, 255, 218), anchor="mm")

    img.save(str(output_path), "PNG")


# ─── Per-clip ffmpeg helpers ──────────────────────────────────────────────────

def extract_first_frame(video_path: Path, output_path: Path) -> None:
    """Pull the first frame from a video as JPEG."""
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path),
         "-vframes", "1", "-q:v", "2", str(output_path)],
        capture_output=True,
        check=True,
    )


def create_clip(
    src_path: Path,
    caption_path: Path,
    output_path: Path,
    zoom_in: bool = True,
) -> None:
    """
    Build a CLIP_DURATION-second H.264 clip from a still image.

    Pipeline:
      scale (cover 1920×1080) → zoompan (Ken Burns) → overlay caption PNG
    """
    total_frames = FPS * CLIP_DURATION  # 120

    # Alternate: even clips zoom in (1.0→1.1), odd clips also zoom in from center
    # (reliably supported across ffmpeg versions without needing 'n' variable)
    if zoom_in:
        zoom_expr = "zoom+0.0008"           # 1.0 → ~1.096 over 120 frames
        x_expr = "iw/2-(iw/zoom/2)"
        y_expr = "ih/2-(ih/zoom/2)"
    else:
        # Subtle pan left while zooming in — gives visual variety
        zoom_expr = "zoom+0.0008"
        x_expr = "iw/2-(iw/zoom/2)-20"     # slight left pan
        y_expr = "ih/2-(ih/zoom/2)"

    filter_complex = (
        f"[0:v]"
        f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={WIDTH}:{HEIGHT},"
        f"zoompan="
        f"z='{zoom_expr}':"
        f"x='{x_expr}':"
        f"y='{y_expr}':"
        f"d={total_frames}:fps={FPS}:s={WIDTH}x{HEIGHT}"
        f"[bg];"
        f"[bg][1:v]overlay=0:0[v]"
    )

    cmd = [
        "ffmpeg", "-y",
        # Source image looped for slightly longer than clip to avoid zoompan stall
        "-loop", "1", "-t", f"{CLIP_DURATION + 0.5}", "-i", str(src_path),
        # Caption overlay (looped static PNG)
        "-loop", "1", "-i", str(caption_path),
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-t", str(CLIP_DURATION),
        "-r", str(FPS),
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg clip failed for {src_path.name}:\n{result.stderr.decode()}"
        )


# ─── Concatenation with xfade ─────────────────────────────────────────────────

def concatenate_clips(clip_paths: list[Path], output_path: Path) -> None:
    """
    Stitch clips together with fade-in → xfade crossfades → fade-out.

    Filter graph for n clips:
      [0:v] fade-in → [f0]
      [f0][1:v] xfade(offset=STEP) → [xf1]
      [xf1][2:v] xfade(offset=2*STEP) → [xf2]
      ...
      [xf{n-1}] fade-out → [out]
    """
    n = len(clip_paths)

    # Single-clip case: just add fades and re-encode
    if n == 1:
        fade_out_st = CLIP_DURATION - FADE_DURATION
        cmd = [
            "ffmpeg", "-y", "-i", str(clip_paths[0]),
            "-vf", (
                f"fade=t=in:st=0:d={FADE_DURATION},"
                f"fade=t=out:st={fade_out_st}:d={FADE_DURATION}"
            ),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg single-clip failed:\n{result.stderr.decode()}")
        return

    # Build filter_complex for n >= 2
    inputs: list[str] = []
    for p in clip_paths:
        inputs += ["-i", str(p)]

    parts: list[str] = []

    # Fade-in on the first clip
    parts.append(f"[0:v]fade=t=in:st=0:d={FADE_DURATION}[f0]")

    # Chain xfade filters between consecutive clips
    prev_label = "f0"
    for i in range(1, n):
        offset = i * STEP
        is_last_xfade = (i == n - 1)
        out_label = "pre_out" if is_last_xfade else f"xf{i}"
        parts.append(
            f"[{prev_label}][{i}:v]"
            f"xfade=transition=fade:duration={FADE_DURATION}:offset={offset}"
            f"[{out_label}]"
        )
        prev_label = out_label

    # Fade-out on the final concatenated stream
    total_dur = n * CLIP_DURATION - (n - 1) * FADE_DURATION
    fade_out_start = total_dur - FADE_DURATION
    parts.append(
        f"[{prev_label}]fade=t=out:st={fade_out_start}:d={FADE_DURATION}[out]"
    )

    filter_complex = ";".join(parts)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg concat failed:\n{result.stderr.decode()}"
        )


# ─── Main export entry point ──────────────────────────────────────────────────

def export_video(output_path: Optional[Path] = None) -> Path:
    """
    Generate the full slideshow video.

    Args:
        output_path: Where to write the MP4. Defaults to DEFAULT_OUTPUT.

    Returns:
        Path to the generated video.
    """
    if output_path is None:
        output_path = DEFAULT_OUTPUT

    print("Loading memories…")
    data = load_memories()
    memories = data.get("memories", [])

    if not memories:
        raise ValueError("No memories found in memories.json")

    print(f"Generating video for {len(memories)} memories…")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        clip_paths: list[Path] = []

        for i, memory in enumerate(memories):
            src = MEDIA_DIR / memory["image"]
            if not src.exists():
                print(f"  [{i + 1}/{len(memories)}] SKIP (missing): {memory['image']}")
                continue

            print(f"  [{i + 1}/{len(memories)}] {memory['image']}")

            # Video sources: extract first frame
            if src.suffix.lower() in VIDEO_EXTS:
                img_path = tmp_path / f"src_{i:04d}.jpg"
                extract_first_frame(src, img_path)
            else:
                img_path = src

            # Render caption overlay
            caption_path = tmp_path / f"caption_{i:04d}.png"
            create_caption_png(memory["description"], memory["date"], caption_path)

            # Build individual clip
            clip_path = tmp_path / f"clip_{i:04d}.mp4"
            create_clip(img_path, caption_path, clip_path, zoom_in=(i % 2 == 0))
            clip_paths.append(clip_path)

        if not clip_paths:
            raise ValueError("No clips could be generated (all source files missing?)")

        print(f"Concatenating {len(clip_paths)} clips with crossfade transitions…")
        concatenate_clips(clip_paths, output_path)

    print(f"Done — video saved to: {output_path}")
    return output_path


def main() -> None:
    try:
        export_video()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
