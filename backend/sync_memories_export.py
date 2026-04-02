from __future__ import annotations

from pathlib import Path

from .storage import MemoryStore


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    MemoryStore(repo_root).sync_public_exports()


if __name__ == '__main__':
    main()
