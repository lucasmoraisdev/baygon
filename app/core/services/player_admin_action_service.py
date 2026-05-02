from datetime import datetime, timezone, timedelta
from typing import Optional, Sequence, Dict, Any
from app.db.models.player_admin_action import PlayerAdminAction, AdminActionTypeEnum
from app.db.repositories.player_admin_action_repository import PlayerAdminActionRepository


class PlayerAdminActionService:
    def __init__(self, repo: PlayerAdminActionRepository):
        self.repo = repo

    async def create_action(self, player_id: int, admin_id: int, action_data: dict) -> PlayerAdminAction:
        """Cria uma nova ação administrativa."""
        action_type = action_data.get("action_type")
        
        # Preparar dados específicos baseado no tipo de ação
        action_dict = {
            "player_id": player_id,
            "admin_id": admin_id,
            "action_type": action_type,
            "description": action_data.get("description"),
            "is_active": True,
        }
        
        # Ações específicas
        if action_type == AdminActionTypeEnum.SUSPEND:
            sus_type = action_data.get("suspension_type", "days")
            value = action_data.get("value", 1)
            
            if sus_type == "days":
                action_dict["suspension_days"] = value
                action_dict["suspension_until"] = datetime.now(timezone.utc) + timedelta(days=value)
                action_dict["description"] = f"Suspenso por {value} dias"
            elif sus_type == "weeks":
                days = value * 7
                action_dict["suspension_days"] = days
                action_dict["suspension_until"] = datetime.now(timezone.utc) + timedelta(days=days)
                action_dict["description"] = f"Suspenso por {value} semanas"
            elif sus_type == "games":
                action_dict["suspension_matches"] = value
                action_dict["description"] = f"Suspenso por {value} jogos"
            elif sus_type == "indefinite":
                action_dict["is_indefinite"] = True
                action_dict["description"] = "Suspenso indefinidamente"
        
        elif action_type == AdminActionTypeEnum.FINE:
            action_dict["fine_amount"] = action_data.get("fine_amount", 0)
            action_dict["description"] = f"Multa de R$ {action_dict['fine_amount']}"
        
        elif action_type == AdminActionTypeEnum.OBSERVE:
            action_dict["observations"] = action_data.get("observations", "")
            action_dict["description"] = "Observação adicionada"
        
        elif action_type == AdminActionTypeEnum.BLOCK:
            action_dict["description"] = "Acesso bloqueado"
        
        elif action_type == AdminActionTypeEnum.UNBLOCK:
            # Desbloquear é na verdade deactivate block
            await self.repo.deactivate_block(player_id)
            return None

        action = PlayerAdminAction(**action_dict)
        return await self.repo.create(action)

    async def get_player_actions(self, player_id: int) -> Sequence[PlayerAdminAction]:
        """Obtém todas as ações administrativas de um jogador."""
        return await self.repo.get_player_actions(player_id)

    async def get_active_suspension(self, player_id: int) -> Optional[Dict[str, Any]]:
        """Obtém informações sobre suspensão ativa."""
        action = await self.repo.get_active_suspension(player_id)
        if not action:
            return None
        
        info = {
            "is_suspended": True,
            "reason": action.description,
            "suspension_matches": action.suspension_matches,
            "is_indefinite": getattr(action, "is_indefinite", False),
        }
        
        if action.suspension_until:
            now = datetime.now(timezone.utc)
            days_remaining = (action.suspension_until - now).days
            hours_remaining = ((action.suspension_until - now).seconds) // 3600
            
            info["suspended_until"] = action.suspension_until
            info["days_remaining"] = max(0, days_remaining)
            info["hours_remaining"] = hours_remaining
            
        return info

    async def get_player_status(self, player_id: int) -> Dict[str, Any]:
        """Obtém status administrativo do jogador."""
        is_blocked = await self.repo.get_is_blocked(player_id)
        suspension_info = await self.get_active_suspension(player_id)
        
        return {
            "is_blocked": is_blocked,
            "suspension": suspension_info,
        }

    async def suspend_player(self, player_id: int, admin_id: int, suspension_data: dict) -> PlayerAdminAction:
        """Suspende um jogador."""
        suspension_data["action_type"] = AdminActionTypeEnum.SUSPEND
        return await self.create_action(player_id, admin_id, suspension_data)

    async def apply_fine(self, player_id: int, admin_id: int, amount: float) -> PlayerAdminAction:
        """Aplica multa a um jogador."""
        return await self.create_action(
            player_id,
            admin_id,
            {
                "action_type": AdminActionTypeEnum.FINE,
                "fine_amount": amount,
            }
        )

    async def add_observation(self, player_id: int, admin_id: int, observation: str) -> PlayerAdminAction:
        """Adiciona observação sobre um jogador."""
        return await self.create_action(
            player_id,
            admin_id,
            {
                "action_type": AdminActionTypeEnum.OBSERVE,
                "observations": observation,
            }
        )

    async def block_player(self, player_id: int, admin_id: int) -> PlayerAdminAction:
        """Bloqueia acesso de um jogador."""
        return await self.create_action(
            player_id,
            admin_id,
            {
                "action_type": AdminActionTypeEnum.BLOCK,
            }
        )

    async def unblock_player(self, player_id: int, admin_id: int) -> bool:
        """Desbloqueia acesso de um jogador."""
        await self.create_action(
            player_id,
            admin_id,
            {
                "action_type": AdminActionTypeEnum.UNBLOCK,
            }
        )
        return True
