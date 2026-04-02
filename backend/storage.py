from __future__ import annotations

import json
import mimetypes
import os
import shutil
import threading
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha1
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.webm', '.ogg', '.m4v'}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS


@dataclass(frozen=True)
class MemoryRecord:
    id: str
    image: str
    date: str
    description: str

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> 'MemoryRecord':
        normalized = {
            'image': payload['image'],
            'date': payload['date'],
            'description': payload.get('description', ''),
        }
        raw = json.dumps(normalized, sort_keys=True, separators=(',', ':'))
        return cls(
            id=sha1(raw.encode('utf-8')).hexdigest()[:12],
            image=normalized['image'],
            date=normalized['date'],
            description=normalized['description'],
        )

    def to_dict(self) -> dict[str, str]:
        return {
            'image': self.image,
            'date': self.date,
            'description': self.description,
        }


class MemoryStore:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.media_dir = repo_root / 'frontend' / 'public' / 'media'
        self.memories_path = self.media_dir / 'memories.json'
        self.memories_module_path = self.media_dir / 'memories.js'
        self._lock = threading.Lock()
        self.media_dir.mkdir(parents=True, exist_ok=True)

    def list_memories(self) -> list[MemoryRecord]:
        data = self._read_data()
        return [MemoryRecord.from_dict(memory) for memory in data['memories']]

    def get_memory(self, memory_id: str) -> MemoryRecord | None:
        for memory in self.list_memories():
            if memory.id == memory_id:
                return memory
        return None

    def add_memory(self, *, image_filename: str, date: str, description: str) -> MemoryRecord:
        normalized_date = self.normalize_date(date)
        with self._lock:
            data = self._read_data()
            data['memories'].append(
                {
                    'image': image_filename,
                    'date': normalized_date,
                    'description': description.strip(),
                }
            )
            data['memories'] = self._sort_memories(data['memories'])
            self._write_data(data)
            return self._find_memory_in_payload(data['memories'], image_filename, normalized_date, description.strip())

    def update_caption(self, memory_id: str, new_caption: str) -> MemoryRecord:
        with self._lock:
            data = self._read_data()
            memory = self._find_memory_dict(data['memories'], memory_id)
            if memory is None:
                raise KeyError('Memory no longer exists. Refresh with /list and try again.')
            memory['description'] = new_caption.strip()
            self._write_data(data)
            return MemoryRecord.from_dict(memory)

    def update_date(self, memory_id: str, new_date: str) -> MemoryRecord:
        normalized_date = self.normalize_date(new_date)
        with self._lock:
            data = self._read_data()
            memory = self._find_memory_dict(data['memories'], memory_id)
            if memory is None:
                raise KeyError('Memory no longer exists. Refresh with /list and try again.')
            memory['date'] = normalized_date
            data['memories'] = self._sort_memories(data['memories'])
            self._write_data(data)
            for item in data['memories']:
                if item['image'] == memory['image'] and item['date'] == normalized_date and item.get('description', '') == memory.get('description', ''):
                    return MemoryRecord.from_dict(item)
            raise RuntimeError('Updated memory could not be reloaded.')

    def replace_media(self, memory_id: str, new_filename: str) -> MemoryRecord:
        with self._lock:
            data = self._read_data()
            memory = self._find_memory_dict(data['memories'], memory_id)
            if memory is None:
                raise KeyError('Memory no longer exists. Refresh with /list and try again.')

            old_filename = memory['image']
            memory['image'] = new_filename
            self._write_data(data)
            self._delete_file_if_orphaned(old_filename, data['memories'])
            return MemoryRecord.from_dict(memory)

    def delete_memory(self, memory_id: str) -> MemoryRecord:
        with self._lock:
            data = self._read_data()
            memories = data['memories']
            index = self._find_memory_index(memories, memory_id)
            if index is None:
                raise KeyError('Memory no longer exists. Refresh with /list and try again.')

            removed = memories.pop(index)
            self._write_data(data)
            self._delete_file_if_orphaned(removed['image'], memories)
            return MemoryRecord.from_dict(removed)

    def save_media_file(self, source_path: Path, extension: str, prefix: str = 'memory') -> str:
        normalized_ext = extension.lower()
        if normalized_ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f'Unsupported media type: {normalized_ext}')

        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S-%f')
        filename = f'{prefix}-{timestamp}{normalized_ext}'
        target_path = self.media_dir / filename
        shutil.copy2(source_path, target_path)
        return filename

    @staticmethod
    def normalize_date(value: str) -> str:
        text = value.strip()
        for pattern in ('%Y-%m-%d', '%Y-%m-%d %H:%M', '%Y/%m/%d'):
            try:
                parsed = datetime.strptime(text, pattern)
                return parsed.strftime('%Y-%m-%d')
            except ValueError:
                continue
        raise ValueError('Date must be in YYYY-MM-DD format.')

    @staticmethod
    def infer_extension(filename: str | None, mime_type: str | None = None, fallback: str = '.jpg') -> str:
        if filename:
            suffix = Path(filename).suffix.lower()
            if suffix:
                return suffix
        if mime_type:
            guess = mimetypes.guess_extension(mime_type)
            if guess:
                return guess.lower()
        return fallback

    def _read_data(self) -> dict[str, Any]:
        if not self.memories_path.exists():
            raise FileNotFoundError(f'Missing {self.memories_path}')
        with self.memories_path.open('r', encoding='utf-8') as handle:
            data = json.load(handle)
        if 'memories' not in data or not isinstance(data['memories'], list):
            raise ValueError(f'Unexpected JSON structure in {self.memories_path}')
        return data

    def _write_data(self, data: dict[str, Any]) -> None:
        payload = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
        with NamedTemporaryFile('w', encoding='utf-8', delete=False, dir=self.memories_path.parent) as temp_handle:
            temp_handle.write(payload)
            temp_path = Path(temp_handle.name)
        os.replace(temp_path, self.memories_path)
        self._write_module(data)

    def sync_public_exports(self) -> None:
        self._write_module(self._read_data())

    def _find_memory_dict(self, memories: list[dict[str, Any]], memory_id: str) -> dict[str, Any] | None:
        for memory in memories:
            if MemoryRecord.from_dict(memory).id == memory_id:
                return memory
        return None

    def _find_memory_index(self, memories: list[dict[str, Any]], memory_id: str) -> int | None:
        for index, memory in enumerate(memories):
            if MemoryRecord.from_dict(memory).id == memory_id:
                return index
        return None

    def _find_memory_in_payload(self, memories: list[dict[str, Any]], image: str, date: str, description: str) -> MemoryRecord:
        for memory in memories:
            if memory['image'] == image and memory['date'] == date and memory.get('description', '') == description:
                return MemoryRecord.from_dict(memory)
        raise RuntimeError('Saved memory could not be reloaded.')

    @staticmethod
    def _sort_memories(memories: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return sorted(memories, key=lambda item: (MemoryStore.normalize_date(item['date']), item.get('image', '')), reverse=True)

    def _delete_file_if_orphaned(self, filename: str, memories: list[dict[str, Any]]) -> None:
        if any(memory.get('image') == filename for memory in memories):
            return
        target_path = self.media_dir / filename
        if target_path.exists():
            target_path.unlink()

    def _write_module(self, data: dict[str, Any]) -> None:
        module_payload = 'export default ' + json.dumps(data, indent=2, ensure_ascii=False) + ';\n'
        with NamedTemporaryFile('w', encoding='utf-8', delete=False, dir=self.memories_module_path.parent) as temp_handle:
            temp_handle.write(module_payload)
            temp_path = Path(temp_handle.name)
        os.replace(temp_path, self.memories_module_path)
