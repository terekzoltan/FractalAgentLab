from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import quote

from fractal_agent_lab.memory.session_memory import SessionMemory


def _safe_file_stem(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", value)


def _encoded_file_stem(value: str) -> str:
    return quote(value, safe="-_.")


class JSONSessionMemoryStore:
    def __init__(
        self,
        *,
        data_dir: str | Path = "data",
        data_subdir: str = "memory",
    ) -> None:
        if not isinstance(data_subdir, str) or not data_subdir.strip():
            raise ValueError("data_subdir must be a non-empty string.")
        self._root_dir = Path(data_dir) / data_subdir
        self._sessions_dir = self._root_dir / "sessions"

    @property
    def root_dir(self) -> Path:
        return self._root_dir

    def load_session(self, *, session_id: str) -> SessionMemory | None:
        path = self._resolve_existing_session_path(session_id=session_id)
        if not path.exists():
            return None

        payload = self._read_json_dict(path)
        return SessionMemory.from_dict(payload)

    def save_session(self, session_memory: SessionMemory) -> Path:
        path = self.session_path(session_id=session_memory.session_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(session_memory.to_dict(), indent=2, ensure_ascii=True), encoding="utf-8")
        return path

    def session_path(self, *, session_id: str) -> Path:
        return self._sessions_dir / f"{_encoded_file_stem(session_id)}.json"

    def _resolve_existing_session_path(self, *, session_id: str) -> Path:
        preferred = self.session_path(session_id=session_id)
        if preferred.exists():
            return preferred

        return self._sessions_dir / f"{_safe_file_stem(session_id)}.json"

    def _read_json_dict(self, path: Path) -> dict[str, object]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"Invalid session memory JSON file at {path.as_posix()}: {error}") from error

        if not isinstance(payload, dict):
            raise ValueError(f"Session memory JSON file must be an object: {path.as_posix()}")
        return payload
