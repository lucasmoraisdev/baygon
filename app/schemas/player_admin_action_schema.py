from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class PlayerAdminActionBase(BaseModel):
    action_type: str  # suspend, fine, block, unblock, observe
    description: Optional[str] = None
    suspension_days: Optional[int] = None
    fine_amount: Optional[float] = None
    observations: Optional[str] = None


class PlayerAdminActionCreate(PlayerAdminActionBase):
    pass


class PlayerAdminActionRead(PlayerAdminActionBase):
    id_action: int
    player_id: int
    admin_id: int
    suspension_until: Optional[datetime] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
