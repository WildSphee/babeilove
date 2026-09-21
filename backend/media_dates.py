"""Dates entered in Telegram and optional photo capture metadata."""

import re
from datetime import date, datetime
from pathlib import Path

from PIL import ExifTags, Image


def parse_input_date(value: str) -> str:
    text = value.strip()
    if re.fullmatch(r'[0-9]{6}', text):
        try:
            return date(2000 + int(text[4:]), int(text[2:4]), int(text[:2])).isoformat()
        except ValueError:
            pass
    raise ValueError('Send a valid date in ddmmyy format, e.g. 210926 for 21 September 2026.')


def date_warning(value: str, today: date | None = None) -> str | None:
    today = today or date.today()
    selected = date.fromisoformat(value)
    try:
        one_year_ago = today.replace(year=today.year - 1)
    except ValueError:  # February 29 in a leap year
        one_year_ago = today.replace(year=today.year - 1, day=28)
    if selected > today:
        return 'in the future'
    if selected < one_year_ago:
        return 'more than one year ago'
    return None


def extract_photo_date(path: Path) -> str | None:
    try:
        with Image.open(path) as photo:
            exif = photo.getexif()
            details = exif.get_ifd(ExifTags.IFD.Exif)
            # Prefer capture time, then digitization time, then modification time.
            for tag in (ExifTags.Base.DateTimeOriginal, ExifTags.Base.DateTimeDigitized, ExifTags.Base.DateTime):
                for source in (details, exif):
                    raw = source.get(tag)
                    if isinstance(raw, bytes):
                        raw = raw.decode('ascii', errors='replace')
                    if not isinstance(raw, str):
                        continue
                    try:
                        return datetime.strptime(raw.strip(' \x00'), '%Y:%m:%d %H:%M:%S').date().isoformat()
                    except ValueError:
                        continue
    except Exception:
        # Missing, unsupported, or malformed metadata must not block an upload.
        return None
    return None
