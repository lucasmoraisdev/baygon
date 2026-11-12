import json
from typing import Dict, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.sumula_import_service import SumulaImportService
from app.core.services.sumula_tabular_service import SumulaTabularService
from app.db.base import get_db
from app.schemas.sumula_schema import (
    SumulaImportRequest,
    SumulaImportResponse,
    SumulaParsedData,
    SumulaPreviewResponse,
)

router = APIRouter(prefix="/sumulas", tags=["Sumulas"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_TABULAR_EXTENSIONS = (".csv", ".xlsx", ".xlsm")


async def _read_validated_image(file: UploadFile) -> bytes:
    if file.content_type and file.content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de imagem não suportado: {file.content_type}. Use JPEG, PNG ou WEBP.",
        )
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo de imagem vazio.",
        )
    return image_bytes


async def _read_validated_tabular(file: UploadFile) -> bytes:
    filename = (file.filename or "").lower()
    if not filename.endswith(ALLOWED_TABULAR_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de planilha não suportado. Envie um arquivo .csv ou .xlsx.",
        )
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo de planilha vazio.",
        )
    return file_bytes


def _parse_extra_points_overrides(extra_points_overrides: Optional[str]) -> Dict[str, int]:
    if not extra_points_overrides:
        return {}
    try:
        parsed_ov = json.loads(extra_points_overrides)
        if not isinstance(parsed_ov, dict):
            raise ValueError("extra_points_overrides deve ser um objeto JSON.")
        return {str(k): int(v) for k, v in parsed_ov.items()}
    except (json.JSONDecodeError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"extra_points_overrides inválido: {exc}",
        ) from exc


def _import_request_from_preview(
    preview: SumulaPreviewResponse,
    overwrite_existing_round: bool,
    create_missing_players: bool,
    update_player_potes: bool,
    register_round_winner_award: bool,
    overrides_map: Dict[str, int],
) -> tuple[SumulaImportRequest, SumulaParsedData]:
    parsed_data = SumulaParsedData(
        provider_used=preview.provider_used,
        header=preview.header,
        teams=preview.teams,
        matches=preview.matches,
        ouros=preview.ouros,
        warnings=preview.warnings,
    )
    import_req = SumulaImportRequest(
        season_id=preview.season_id,
        round_number=preview.round_number,
        overwrite_existing_round=overwrite_existing_round,
        create_missing_players=create_missing_players,
        update_player_potes=update_player_potes,
        register_round_winner_award=register_round_winner_award,
        extra_points_overrides=overrides_map,
        header=preview.header,
        teams=preview.teams,
        matches=preview.matches,
        ouros=preview.ouros,
    )
    return import_req, parsed_data


@router.get("/template", status_code=status.HTTP_200_OK)
async def download_sumula_template(
    format: Literal["xlsx", "csv"] = Query("xlsx", description="Formato do modelo: xlsx ou csv"),
    include_example: bool = Query(True, description="Se true, preenche com os dados reais do Baba 1 como exemplo"),
    delimiter: Literal[",", ";"] = Query(",", description="Separador usado no CSV (, ou ;)"),
):
    """Baixa o modelo padrão em Excel (.xlsx) ou CSV (.csv) para preenchimento e importação de súmulas."""
    tabular = SumulaTabularService()
    if format == "csv":
        content = tabular.build_template_csv(include_example=include_example, delimiter=delimiter)
        filename = "modelo_sumula_baba1.csv" if include_example else "modelo_sumula_vazio.csv"
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    content = tabular.build_template_xlsx(include_example=include_example)
    filename = "modelo_sumula_baba1.xlsx" if include_example else "modelo_sumula_vazio.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview", response_model=SumulaPreviewResponse, status_code=status.HTTP_200_OK)
async def preview_sumula(
    file: UploadFile = File(...),
    season_id: Optional[int] = Form(None),
    round_number: Optional[int] = Form(None),
    provider: str = Form("auto"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Extrai e estrutura os dados da imagem da súmula sem persistir no banco."""
    image_bytes = await _read_validated_image(file)
    service = SumulaImportService(db)
    try:
        return await service.preview_sumula(
            image_bytes=image_bytes,
            season_id=season_id,
            round_number=round_number,
            provider=provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/preview-file", response_model=SumulaPreviewResponse, status_code=status.HTTP_200_OK)
async def preview_sumula_file(
    file: UploadFile = File(...),
    season_id: Optional[int] = Form(None),
    round_number: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Lê e valida uma súmula em formato CSV ou Excel (.xlsx) sem persistir no banco."""
    file_bytes = await _read_validated_tabular(file)
    service = SumulaImportService(db)
    try:
        return await service.preview_sumula_file(
            file_bytes=file_bytes,
            filename=file.filename or "",
            season_id=season_id,
            round_number=round_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/import", response_model=SumulaImportResponse, status_code=status.HTTP_201_CREATED)
async def import_sumula_structured(
    payload: SumulaImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Cadastra rodada, jogadores, times, partidas, eventos, ouros e pontuações a partir do JSON revisado."""
    service = SumulaImportService(db)
    return await service.import_sumula(
        payload=payload,
        current_user_id=current_user.id_user,
    )


@router.post("/import-image", response_model=SumulaImportResponse, status_code=status.HTTP_201_CREATED)
async def import_sumula_from_image(
    file: UploadFile = File(...),
    season_id: int = Form(...),
    round_number: Optional[int] = Form(None),
    provider: str = Form("auto"),
    overwrite_existing_round: bool = Form(False),
    create_missing_players: bool = Form(True),
    update_player_potes: bool = Form(True),
    register_round_winner_award: bool = Form(True),
    extra_points_overrides: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Extrai os dados da imagem da súmula e cadastra diretamente no banco em uma única chamada."""
    image_bytes = await _read_validated_image(file)
    overrides_map = _parse_extra_points_overrides(extra_points_overrides)

    service = SumulaImportService(db)
    try:
        preview = await service.preview_sumula(
            image_bytes=image_bytes,
            season_id=season_id,
            round_number=round_number,
            provider=provider,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    import_req, parsed_data = _import_request_from_preview(
        preview=preview,
        overwrite_existing_round=overwrite_existing_round,
        create_missing_players=create_missing_players,
        update_player_potes=update_player_potes,
        register_round_winner_award=register_round_winner_award,
        overrides_map=overrides_map,
    )
    return await service.import_sumula(
        payload=import_req,
        current_user_id=current_user.id_user,
        parsed_data=parsed_data,
    )


@router.post("/import-file", response_model=SumulaImportResponse, status_code=status.HTTP_201_CREATED)
async def import_sumula_from_file(
    file: UploadFile = File(...),
    season_id: int = Form(...),
    round_number: Optional[int] = Form(None),
    overwrite_existing_round: bool = Form(False),
    create_missing_players: bool = Form(True),
    update_player_potes: bool = Form(True),
    register_round_winner_award: bool = Form(True),
    extra_points_overrides: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Importa diretamente uma súmula preenchida em CSV ou Excel (.xlsx) para o banco."""
    file_bytes = await _read_validated_tabular(file)
    overrides_map = _parse_extra_points_overrides(extra_points_overrides)

    service = SumulaImportService(db)
    try:
        preview = await service.preview_sumula_file(
            file_bytes=file_bytes,
            filename=file.filename or "",
            season_id=season_id,
            round_number=round_number,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    import_req, parsed_data = _import_request_from_preview(
        preview=preview,
        overwrite_existing_round=overwrite_existing_round,
        create_missing_players=create_missing_players,
        update_player_potes=update_player_potes,
        register_round_winner_award=register_round_winner_award,
        overrides_map=overrides_map,
    )
    return await service.import_sumula(
        payload=import_req,
        current_user_id=current_user.id_user,
        parsed_data=parsed_data,
    )
