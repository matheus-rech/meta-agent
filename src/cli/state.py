"""State persistence and conversation memory for Meta CLI."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any


class ProjectState:
    """Manages project state persistence."""

    def __init__(self, project_dir: Path | None = None):
        self.project_dir = project_dir or Path.cwd()
        self.state_path = self.project_dir / ".meta" / "state.json"
        self._state: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        """Load state from disk."""
        if self.state_path.exists():
            with open(self.state_path) as f:
                self._state = json.load(f)
        else:
            self._state = self._default_state()

    def _save(self) -> None:
        """Save state to disk."""
        self._state["updated"] = datetime.now().isoformat()
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_path, "w") as f:
            json.dump(self._state, f, indent=2)

    def _default_state(self) -> dict[str, Any]:
        """Return default state structure."""
        return {
            "phase": "protocol",
            "created": datetime.now().isoformat(),
            "updated": datetime.now().isoformat(),
            "searches": [],
            "screening": {
                "total": 0,
                "included": 0,
                "excluded": 0,
                "pending": 0,
            },
            "extractions": [],
            "analyses": [],
        }

    @property
    def phase(self) -> str:
        """Get current project phase."""
        return self._state.get("phase", "protocol")

    @phase.setter
    def phase(self, value: str) -> None:
        """Set project phase."""
        valid_phases = ["protocol", "search", "screening", "extraction", "analysis", "writing", "complete"]
        if value not in valid_phases:
            raise ValueError(f"Invalid phase: {value}")
        self._state["phase"] = value
        self._save()

    def add_search(self, query: str, database: str, results: int, date: str | None = None) -> None:
        """Record a search."""
        search = {
            "query": query,
            "database": database,
            "results": results,
            "date": date or datetime.now().isoformat(),
        }
        self._state.setdefault("searches", []).append(search)
        self._save()

    def update_screening(self, total: int = 0, included: int = 0, excluded: int = 0, pending: int = 0) -> None:
        """Update screening progress."""
        self._state["screening"] = {
            "total": total,
            "included": included,
            "excluded": excluded,
            "pending": pending,
        }
        self._save()

    def add_extraction(self, study_id: str) -> None:
        """Record an extraction."""
        if study_id not in self._state.get("extractions", []):
            self._state.setdefault("extractions", []).append(study_id)
            self._save()

    def add_analysis(self, outcome: str, result: dict[str, Any]) -> None:
        """Record an analysis result."""
        analysis = {
            "outcome": outcome,
            "date": datetime.now().isoformat(),
            **result
        }
        self._state.setdefault("analyses", []).append(analysis)
        self._save()

    @property
    def stats(self) -> dict[str, Any]:
        """Get project statistics."""
        return {
            "phase": self.phase,
            "searches": len(self._state.get("searches", [])),
            "total_results": sum(s.get("results", 0) for s in self._state.get("searches", [])),
            "screening": self._state.get("screening", {}),
            "extractions": len(self._state.get("extractions", [])),
            "analyses": len(self._state.get("analyses", [])),
        }


class ConversationMemory:
    """Manages conversation history persistence."""

    def __init__(self, project_dir: Path | None = None):
        self.project_dir = project_dir or Path.cwd()
        self.memory_path = self.project_dir / ".meta" / "memory.json"
        self._memory: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        """Load memory from disk."""
        if self.memory_path.exists():
            with open(self.memory_path) as f:
                self._memory = json.load(f)
        else:
            self._memory = {"conversations": [], "context": {}}

    def _save(self) -> None:
        """Save memory to disk."""
        self.memory_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.memory_path, "w") as f:
            json.dump(self._memory, f, indent=2)

    def add_turn(self, role: str, content: str, metadata: dict[str, Any] | None = None) -> None:
        """Add a conversation turn."""
        turn = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        }
        if metadata:
            turn["metadata"] = metadata

        self._memory.setdefault("conversations", []).append(turn)

        # Keep only last 100 turns to avoid bloat
        if len(self._memory["conversations"]) > 100:
            self._memory["conversations"] = self._memory["conversations"][-100:]

        self._save()

    def get_recent(self, n: int = 10) -> list[dict[str, Any]]:
        """Get recent conversation turns."""
        return self._memory.get("conversations", [])[-n:]

    def set_context(self, key: str, value: Any) -> None:
        """Set a context value."""
        self._memory.setdefault("context", {})[key] = value
        self._save()

    def get_context(self, key: str, default: Any = None) -> Any:
        """Get a context value."""
        return self._memory.get("context", {}).get(key, default)

    def clear_context(self, key: str | None = None) -> None:
        """Clear context (specific key or all)."""
        if key:
            self._memory.get("context", {}).pop(key, None)
        else:
            self._memory["context"] = {}
        self._save()

    def get_summary(self) -> str:
        """Get a summary of conversation for context injection."""
        turns = self.get_recent(20)
        if not turns:
            return ""

        summary_parts = []
        for turn in turns:
            role = turn["role"]
            content = turn["content"][:200]  # Truncate long messages
            if len(turn["content"]) > 200:
                content += "..."
            summary_parts.append(f"{role}: {content}")

        return "\n".join(summary_parts)

    @property
    def turn_count(self) -> int:
        """Get total number of conversation turns."""
        return len(self._memory.get("conversations", []))


class AnalysisCache:
    """Cache for analysis results to avoid re-computation."""

    def __init__(self, project_dir: Path | None = None):
        self.project_dir = project_dir or Path.cwd()
        self.cache_dir = self.project_dir / ".meta" / "cache"

    def get(self, key: str) -> dict[str, Any] | None:
        """Get cached analysis result."""
        cache_file = self.cache_dir / f"{key}.json"
        if cache_file.exists():
            with open(cache_file) as f:
                cached = json.load(f)
            # Check if cache is still valid (24 hours)
            cached_time = datetime.fromisoformat(cached.get("timestamp", "2000-01-01"))
            if (datetime.now() - cached_time).days < 1:
                return cached.get("data")
        return None

    def set(self, key: str, data: dict[str, Any]) -> None:
        """Cache an analysis result."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = self.cache_dir / f"{key}.json"
        with open(cache_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "data": data
            }, f, indent=2)

    def clear(self, key: str | None = None) -> None:
        """Clear cache (specific key or all)."""
        if key:
            cache_file = self.cache_dir / f"{key}.json"
            cache_file.unlink(missing_ok=True)
        else:
            import shutil
            if self.cache_dir.exists():
                shutil.rmtree(self.cache_dir)
