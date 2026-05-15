from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Protocol, runtime_checkable

from google.cloud import firestore as gc_firestore

from config import get_settings
from models.schemas import CrisisDossier, CrisisStatus

logger = logging.getLogger(__name__)


@runtime_checkable
class CrisisRepository(Protocol):
    async def save(self, dossier: CrisisDossier) -> None: ...
    async def get(self, crisis_id: str) -> CrisisDossier | None: ...
    async def list(
        self,
        *,
        limit: int = 50,
        status: CrisisStatus | None = None,
    ) -> list[CrisisDossier]: ...

    async def update_status(self, crisis_id: str, status: CrisisStatus) -> CrisisDossier | None: ...


class MemoryCrisisRepository:
    def __init__(self) -> None:
        self._data: dict[str, CrisisDossier] = {}

    async def save(self, dossier: CrisisDossier) -> None:
        self._data[dossier.crisis_id] = dossier

    async def get(self, crisis_id: str) -> CrisisDossier | None:
        return self._data.get(crisis_id)

    async def list(
        self,
        *,
        limit: int = 50,
        status: CrisisStatus | None = None,
    ) -> list[CrisisDossier]:
        rows = list(self._data.values())
        rows.sort(key=lambda d: d.created_at, reverse=True)
        if status is not None:
            rows = [d for d in rows if d.status == status]
        return rows[:limit]

    async def update_status(self, crisis_id: str, status: CrisisStatus) -> CrisisDossier | None:
        d = self._data.get(crisis_id)
        if not d:
            return None
        d.status = status
        d.updated_at = datetime.now(timezone.utc)
        return d


class FirestoreCrisisRepository:
    def __init__(self, client: gc_firestore.Client, collection: str = "crises") -> None:
        self._db = client
        self._collection = collection

    async def save(self, dossier: CrisisDossier) -> None:
        ref = self._db.collection(self._collection).document(dossier.crisis_id)

        def _set() -> None:
            ref.set(dossier.to_firestore_dict())

        await asyncio.to_thread(_set)

    async def get(self, crisis_id: str) -> CrisisDossier | None:
        ref = self._db.collection(self._collection).document(crisis_id)

        def _get() -> CrisisDossier | None:
            snap = ref.get()
            if not snap.exists:
                return None
            return CrisisDossier.from_firestore_dict(snap.to_dict())

        return await asyncio.to_thread(_get)

    async def list(
        self,
        *,
        limit: int = 50,
        status: CrisisStatus | None = None,
    ) -> list[CrisisDossier]:
        col = self._db.collection(self._collection)

        def _list() -> list[CrisisDossier]:
            snaps = col.limit(200).stream()
            items = [CrisisDossier.from_firestore_dict(s.to_dict()) for s in snaps]
            if status is not None:
                items = [i for i in items if i.status == status]
            items.sort(key=lambda d: d.created_at, reverse=True)
            return items[:limit]

        return await asyncio.to_thread(_list)

    async def update_status(self, crisis_id: str, status: CrisisStatus) -> CrisisDossier | None:
        ref = self._db.collection(self._collection).document(crisis_id)

        def _upd() -> CrisisDossier | None:
            snap = ref.get()
            if not snap.exists:
                return None
            now = datetime.now(timezone.utc).isoformat()
            ref.update({"status": status.value, "updated_at": now})
            data = snap.to_dict() or {}
            data["status"] = status.value
            data["updated_at"] = now
            return CrisisDossier.from_firestore_dict(data)

        return await asyncio.to_thread(_upd)


def build_repository() -> CrisisRepository:
    settings = get_settings()
    if not settings.use_firestore:
        logger.info("Using in-memory crisis repository (USE_FIRESTORE=false).")
        return MemoryCrisisRepository()
    try:
        proj = settings.firebase_project_id or settings.google_cloud_project
        client = gc_firestore.Client(project=proj)
        logger.info("Firestore client initialised for crises collection.")
        return FirestoreCrisisRepository(client)
    except Exception as e:
        logger.warning("Firestore unavailable (%s); falling back to memory store.", e)
        return MemoryCrisisRepository()


_repo: CrisisRepository | None = None


def get_repository() -> CrisisRepository:
    global _repo
    if _repo is None:
        _repo = build_repository()
    return _repo
