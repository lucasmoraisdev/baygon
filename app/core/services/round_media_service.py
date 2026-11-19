from typing import Optional, Sequence
from urllib.parse import urlparse
from fastapi import HTTPException
from sqlalchemy import select
from app.db.models.round import Round
from app.db.models.round_media import RoundMedia
from app.db.repositories.round_media_repository import RoundMediaRepository


def detect_media_type(url: str, explicit_type: Optional[str] = None) -> str:
    if explicit_type and explicit_type.strip() in {"youtube", "instagram", "tiktok", "other"}:
        return explicit_type.strip().lower()

    parsed = urlparse(url.strip())
    netloc = parsed.netloc.lower()

    if any(domain in netloc for domain in ["youtube.com", "youtu.be", "m.youtube.com"]):
        return "youtube"
    elif any(domain in netloc for domain in ["instagram.com", "instagr.am"]):
        return "instagram"
    elif any(domain in netloc for domain in ["tiktok.com", "vm.tiktok.com"]):
        return "tiktok"

    return "other"


class RoundMediaService:
    def __init__(self, repo: RoundMediaRepository):
        self.repo = repo

    async def _ensure_round_exists(self, round_id: int) -> Round:
        stmt = select(Round).where(Round.id_round == round_id, Round.deleted_at.is_(None))
        rnd = (await self.repo.db.execute(stmt)).scalar_one_or_none()
        if not rnd:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")
        return rnd

    async def list_round_media(self, round_id: int) -> Sequence[RoundMedia]:
        await self._ensure_round_exists(round_id)
        return await self.repo.list_by_round(round_id)

    async def create_round_media(
        self,
        round_id: int,
        url: str,
        title: Optional[str] = None,
        media_type: Optional[str] = None,
        description: Optional[str] = None,
    ) -> RoundMedia:
        await self._ensure_round_exists(round_id)
        clean_url = url.strip()
        if not clean_url:
            raise HTTPException(status_code=400, detail="URL inválida.")

        detected_type = detect_media_type(clean_url, media_type)
        return await self.repo.create(
            round_id=round_id,
            media_type=detected_type,
            url=clean_url,
            title=title.strip() if title else None,
            description=description.strip() if description else None,
        )

    async def delete_round_media(self, round_id: int, media_id: int) -> bool:
        await self._ensure_round_exists(round_id)
        media = await self.repo.get_by_id(media_id)
        if not media or media.round_id != round_id:
            raise HTTPException(status_code=404, detail="Mídia não encontrada nesta rodada.")
        return await self.repo.delete(media_id)
