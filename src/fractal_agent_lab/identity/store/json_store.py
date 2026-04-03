from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

from fractal_agent_lab.identity.models import IdentityProfile, IdentitySnapshot


def _safe_file_stem(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", value)


def _encoded_file_stem(value: str) -> str:
    return quote(value, safe="-_.")


class JSONIdentityStore:
    def __init__(
        self,
        *,
        data_dir: str | Path = "data",
        data_subdir: str = "identity",
    ) -> None:
        if not isinstance(data_subdir, str) or not data_subdir.strip():
            raise ValueError("data_subdir must be a non-empty string.")

        self._root_dir = Path(data_dir) / data_subdir
        self._snapshots_dir = self._root_dir / "snapshots"

    @property
    def root_dir(self) -> Path:
        return self._root_dir

    def load_profile(self, *, agent_id: str) -> IdentityProfile | None:
        path = self._resolve_existing_profile_path(agent_id=agent_id)
        if not path.exists():
            return None

        payload = self._read_json_dict(path)
        return IdentityProfile.from_dict(payload)

    def save_profile(self, profile: IdentityProfile) -> Path:
        path = self.profile_path(agent_id=profile.agent_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(profile.to_dict(), indent=2, ensure_ascii=True), encoding="utf-8")
        return path

    def list_agent_ids(self) -> list[str]:
        if not self._root_dir.exists():
            return []

        agent_ids: list[str] = []
        for path in sorted(self._root_dir.glob("*.json")):
            payload = self._read_json_dict(path)
            agent_id = payload.get("agent_id")
            if isinstance(agent_id, str) and agent_id:
                agent_ids.append(agent_id)
        return agent_ids

    def save_snapshot(self, snapshot: IdentitySnapshot) -> Path:
        path = self.snapshots_path(agent_id=snapshot.agent_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(snapshot.to_dict(), ensure_ascii=True))
            handle.write("\n")
        return path

    def load_snapshots(self, *, agent_id: str) -> list[IdentitySnapshot]:
        path = self._resolve_existing_snapshots_path(agent_id=agent_id)
        if not path.exists():
            return []

        return list(self._read_snapshots(path))

    def profile_path(self, *, agent_id: str) -> Path:
        return self._root_dir / f"{_encoded_file_stem(agent_id)}.json"

    def snapshots_path(self, *, agent_id: str) -> Path:
        return self._snapshots_dir / f"{_encoded_file_stem(agent_id)}.jsonl"

    def _resolve_existing_profile_path(self, *, agent_id: str) -> Path:
        preferred = self.profile_path(agent_id=agent_id)
        if preferred.exists():
            return preferred

        return self._root_dir / f"{_safe_file_stem(agent_id)}.json"

    def _resolve_existing_snapshots_path(self, *, agent_id: str) -> Path:
        preferred = self.snapshots_path(agent_id=agent_id)
        if preferred.exists():
            return preferred

        return self._snapshots_dir / f"{_safe_file_stem(agent_id)}.jsonl"

    def _read_json_dict(self, path: Path) -> dict[str, object]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError(f"Invalid identity JSON file at {path.as_posix()}: {error}") from error

        if not isinstance(payload, dict):
            raise ValueError(f"Identity JSON file must be an object: {path.as_posix()}")
        return payload

    def _read_snapshots(self, path: Path) -> Iterable[IdentitySnapshot]:
        try:
            content = path.read_text(encoding="utf-8")
        except OSError as error:
            raise ValueError(f"Failed to read identity snapshot file {path.as_posix()}: {error}") from error

        for line_number, raw_line in enumerate(content.splitlines(), start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"Invalid identity snapshot JSON at {path.as_posix()}:{line_number}: {error.msg}",
                ) from error
            if not isinstance(payload, dict):
                raise ValueError(
                    f"Identity snapshot line must be a JSON object at {path.as_posix()}:{line_number}",
                )
            yield IdentitySnapshot.from_dict(payload)
