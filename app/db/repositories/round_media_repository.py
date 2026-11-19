from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.round_media import RoundMedia


class RoundMediaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_round(self, round_id: int) -> Sequence[RoundMedia]:
        stmt = (
            select(RoundMedia)
            .where(RoundMedia.round_id == round_id, RoundMedia.deleted_at.is_(None))
            .order_by(RoundMedia.created_at.desc(), RoundMedia.id_round_media.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_id(self, media_id: int) -> Optional[RoundMedia]:
        stmt = select(RoundMedia).where(
            RoundMedia.id_round_media == media_id,
            RoundMedia.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        round_id: int,
        media_type: str,
        url: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> RoundMedia:
        media = RoundMedia(
            round_id=round_id,
            media_type=media_type,
            url=url,
            title=title,
            description=description,
        )
        self.db.add(media)
        await self.db.commit()
        await self.db.refresh(media)
        return media

    async def delete(self, media_id: int) -> bool:
        media = await self.get_by_id(media_id)
        if not media:
            return False
        await self.db.delete(media)
        await self.db.commit()
        return True
