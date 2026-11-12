import csv
import io
from typing import Any, Dict, List, Optional, Sequence, Tuple

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

from app.core.services.sumula_ocr_service import (
    _is_dash_text,
    _parse_date_str,
    _parse_total_points,
    fuzzy_match_name,
    normalize_text,
)
from app.schemas.sumula_schema import (
    SumulaGoalAssistItem,
    SumulaHeader,
    SumulaMatchItem,
    SumulaOuroItem,
    SumulaParsedData,
    SumulaPlayerRow,
    SumulaTeamBlock,
)

HEADER_COLUMNS = [
    "data",
    "baba_numero",
    "local",
    "juiz",
    "total_gols",
    "total_assistencias",
]

TEAMS_COLUMNS = [
    "time_slot",
    "time_campeao",
    "pote_linha",
    "nome",
    "gols",
    "assistencias",
    "vitorias",
    "derrotas",
    "empates",
    "pontuacao_total",
]

MATCHES_COLUMNS = [
    "partida_num",
    "time_casa",
    "gols_casa",
    "gols_visitante",
    "time_visitante",
    "gol_1",
    "assist_1",
    "gol_2",
    "assist_2",
    "gol_3",
    "assist_3",
    "gol_4",
    "assist_4",
    "gol_5",
    "assist_5",
    "camera",
]

OUROS_COLUMNS = [
    "jogador",
    "quantidade",
]

# Dados reais da Súmula Baba 01 (07/11/26) usados como modelo de referência
BABA1_HEADER_ROWS = [
    ["07/11/26", 1, "ARENA BAYGON", "CRUZ", 51, 37],
]

BABA1_TEAMS_ROWS = [
    # Time 1 (topo esquerda)
    [1, "NAO", 1, "DIEGO", 4, 3, 3, 5, 0, "17+3"],
    [1, "NAO", 2, "CABREIRO", 2, 2, 3, 5, 0, "14+3"],
    [1, "NAO", 3, "BOLA 7", 4, 1, 3, 5, 0, "15+3"],
    [1, "NAO", 4, "N. CAGE", 1, 1, 3, 5, 0, "12+3"],
    [1, "NAO", 5, "DUDO", 1, 0, 3, 5, 0, "11"],
    # Time 2 (baixo esquerda - Campeões)
    [2, "SIM", 1, "ADILSON", 8, 8, 7, 3, 0, "38+3"],
    [2, "SIM", 2, "JANDERSON", 3, 2, 7, 3, 0, "27"],
    [2, "SIM", 3, "ED REX", 9, 3, 7, 3, 0, "31"],
    [2, "SIM", 4, "BARATA", 1, 1, 7, 3, 0, "24+3"],
    [2, "SIM", 5, "TUTA", 0, 2, 7, 3, 0, "24+3"],
    # Time 3 (topo meio)
    [3, "NAO", 1, "L. BIEBER", 3, 2, 2, 4, 0, "12"],
    [3, "NAO", 2, "MASSA", 0, 0, 2, 4, 0, "7"],
    [3, "NAO", 3, "MESSI", 2, 1, 2, 4, 0, "10+3"],
    [3, "NAO", 4, "FABINHO", 0, 0, 2, 4, 0, "7"],
    [3, "NAO", 5, "ARI", 0, 0, 2, 4, 0, "7+3"],
    # Time 4 (baixo meio)
    [4, "NAO", 1, "RICK", 7, 0, 4, 4, 0, "20"],
    [4, "NAO", 2, "MILSON", 2, 3, 4, 4, 0, "18"],
    [4, "NAO", 3, "PIROCA", 0, 1, 2, 1, 0, "8"],
    [4, "NAO", 4, "TARTA", 0, 1, 4, 4, 0, "14"],
    [4, "NAO", 5, "GB", 1, 2, 4, 4, 0, "16"],
    [4, "NAO", 6, "SALSICHA", 3, 4, 5, 5, 0, "23+3"],
    # Time 5 (topo direita - apenas 1 jogador = extra, não forma time)
    [5, "NAO", "EXTRA", "X-BACON", 0, 0, 1, 2, 0, "4"],
]

BABA1_MATCHES_ROWS = [
    [1, "DIEGO", 0, 1, "RICK", "GB", "PIROCA", "", "", "", "", "", "", "", "", "ADILSON"],
    [2, "ADILSON", 3, 1, "RICK", "ADILSON", "SALSICHA", "MILSON", "GB", "ADILSON", "SALSICHA", "SALSICHA", "ADILSON", "", "", "BOLA 7"],
    [3, "ADILSON", 0, 1, "L. BIEBER", "L. BIEBER", "", "", "", "", "", "", "", "", "", "BOLA 7"],
    [4, "DIEGO", 3, 0, "L. BIEBER", "DIEGO", "CABREIRO", "DIEGO", "", "DIEGO", "CABREIRO", "", "", "", "", "SALSICHA"],
    [5, "DIEGO", 2, 3, "RICK", "RICK", "SALSICHA", "BOLA 7", "DIEGO", "SALSICHA", "MILSON", "N. CAGE", "BOLA 7", "RICK", "MILSON", "PIROCA"],
    [6, "ADILSON", 3, 1, "RICK", "ADILSON", "ED REX", "RICK", "", "BARATA", "JANDERSON", "JANDERSON", "ADILSON", "", "", "PIROCA"],
    [7, "ADILSON", 1, 0, "L. BIEBER", "ADILSON", "ED REX", "", "", "", "", "", "", "", "", "PIROCA"],
    [8, "ADILSON", 1, 2, "DIEGO", "DUDO", "N. CAGE", "DIEGO", "", "ED REX", "", "", "", "", "", "PIROCA"],
    [9, "RICK", 3, 1, "DIEGO", "BOLA 7", "", "MILSON", "GB", "RICK", "SALSICHA", "RICK", "", "", "", "PIROCA"],
    [10, "RICK", 3, 1, "L. BIEBER", "RICK", "", "RICK", "MILSON", "MESSI", "L. BIEBER", "SALSICHA", "TARTA", "", "", "PIROCA"],
    [11, "RICK", 0, 3, "ADILSON", "ED REX", "ADILSON", "ED REX", "BARATA", "JANDERSON", "ED REX", "", "", "", "", "DUDO"],
    [12, "DIEGO", 0, 3, "ADILSON", "ED REX", "ADILSON", "ED REX", "", "ADILSON", "JANDERSON", "", "", "", "", "GB"],
    [13, "L. BIEBER", 1, 3, "ADILSON", "ED REX", "TUTA", "L. BIEBER", "", "ED REX", "ADILSON", "JANDERSON", "ADILSON", "", "", "GB"],
    [14, "RICK", 0, 3, "ADILSON", "ADILSON", "", "ED REX", "ADILSON", "ADILSON", "", "", "", "", "", "BOLA 7"],
    [15, "DIEGO", 3, 2, "ADILSON", "BOLA 7", "DIEGO", "ADILSON", "TUTA", "BOLA 7", "", "ED REX", "ADILSON", "CABREIRO", "", "MILSON"],
    [16, "DIEGO", 1, 2, "L. BIEBER", "CABREIRO", "DIEGO", "L. BIEBER", "MESSI", "MESSI", "L. BIEBER", "", "", "", "", "MILSON"],
]

BABA1_OUROS_ROWS = [
    ["TUTA", 1],
    ["DUDO", 1],
    ["SALSICHA", 1],
    ["CABREIRO", 2],
    ["FABINHO", 1],
    ["BOLA 7", 1],
    ["BARATA", 1],
    ["ADILSON", 1],
]


def _cell_str(val: Any) -> str:
    if val is None:
        return ""
    return str(val).strip()


def _cell_int(val: Any, default: int = 0) -> int:
    s = _cell_str(val)
    if not s or _is_dash_text(s):
        return default
    try:
        return int(float(s.replace(",", ".")))
    except ValueError:
        return default


def _parse_bool(val: Any) -> bool:
    s = normalize_text(_cell_str(val))
    return s in {"SIM", "S", "TRUE", "1", "YES", "Y", "X", "CAMPEAO", "CAMPEOES"}


def _decode_csv_text(raw_bytes: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return raw_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Não foi possível decodificar o arquivo CSV (use UTF-8 ou Latin-1).")


class SumulaTabularService:
    """Gera modelos padrão CSV/XLSX da súmula e realiza o parse para importação."""

    def build_template_csv(self, include_example: bool = True, delimiter: str = ",") -> bytes:
        buf = io.StringIO()
        writer = csv.writer(buf, delimiter=delimiter, lineterminator="\n")

        writer.writerow(["[CABECALHO]"])
        writer.writerow(HEADER_COLUMNS)
        if include_example:
            for row in BABA1_HEADER_ROWS:
                writer.writerow(row)
        else:
            writer.writerow(["DD/MM/AA", 1, "ARENA BAYGON", "", 0, 0])

        writer.writerow([])
        writer.writerow(["[TIMES_JOGADORES]"])
        writer.writerow(TEAMS_COLUMNS)
        if include_example:
            for row in BABA1_TEAMS_ROWS:
                writer.writerow(row)
        else:
            for slot in range(1, 5):
                for pote in range(1, 6):
                    writer.writerow([slot, "NAO", pote, "", 0, 0, 0, 0, 0, "0"])

        writer.writerow([])
        writer.writerow(["[PARTIDAS]"])
        writer.writerow(MATCHES_COLUMNS)
        if include_example:
            for row in BABA1_MATCHES_ROWS:
                writer.writerow(row)
        else:
            writer.writerow([1, "", 0, 0, "", "", "", "", "", "", "", "", "", "", "", ""])

        writer.writerow([])
        writer.writerow(["[OUROS]"])
        writer.writerow(OUROS_COLUMNS)
        if include_example:
            for row in BABA1_OUROS_ROWS:
                writer.writerow(row)
        else:
            writer.writerow(["", 1])

        return buf.getvalue().encode("utf-8-sig")

    def build_template_xlsx(self, include_example: bool = True) -> bytes:
        wb = Workbook()
        header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")

        def _populate_sheet(ws, columns: List[str], rows: List[List[Any]], widths: Optional[Dict[int, int]] = None):
            ws.append(columns)
            for col_idx in range(1, len(columns) + 1):
                cell = ws.cell(row=1, column=col_idx)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = Alignment(horizontal="center", vertical="center")
            for r in rows:
                ws.append(r)
            for col_idx, col_name in enumerate(columns, start=1):
                col_letter = ws.cell(row=1, column=col_idx).column_letter
                ws.column_dimensions[col_letter].width = (widths or {}).get(col_idx, max(13, len(col_name) + 4))
            ws.freeze_panes = "A2"

        ws_header = wb.active
        ws_header.title = "Cabecalho"
        _populate_sheet(
            ws_header,
            HEADER_COLUMNS,
            BABA1_HEADER_ROWS if include_example else [["DD/MM/AA", 1, "ARENA BAYGON", "", 0, 0]],
            {3: 22, 4: 18},
        )

        ws_teams = wb.create_sheet("Times_Jogadores")
        _populate_sheet(
            ws_teams,
            TEAMS_COLUMNS,
            BABA1_TEAMS_ROWS if include_example else [
                [slot, "NAO", pote, "", 0, 0, 0, 0, 0, "0"]
                for slot in range(1, 5)
                for pote in range(1, 6)
            ],
            {4: 20, 10: 18},
        )

        ws_matches = wb.create_sheet("Partidas")
        _populate_sheet(
            ws_matches,
            MATCHES_COLUMNS,
            BABA1_MATCHES_ROWS if include_example else [[1, "", 0, 0, "", "", "", "", "", "", "", "", "", "", "", ""]],
            {2: 16, 5: 16, 16: 16},
        )

        ws_ouros = wb.create_sheet("Ouros")
        _populate_sheet(
            ws_ouros,
            OUROS_COLUMNS,
            BABA1_OUROS_ROWS if include_example else [["", 1]],
            {1: 22, 2: 14},
        )

        out = io.BytesIO()
        wb.save(out)
        return out.getvalue()

    def parse_file(
        self,
        file_bytes: bytes,
        filename: str,
        known_players: Sequence[Tuple[int, str]] = (),
    ) -> SumulaParsedData:
        lower = (filename or "").lower()
        if lower.endswith((".xlsx", ".xlsm")):
            sections = self._read_xlsx_sections(file_bytes)
            provider = "xlsx"
        elif lower.endswith(".csv"):
            sections = self._read_csv_sections(file_bytes)
            provider = "csv"
        else:
            raise ValueError("Formato de planilha não suportado. Envie .csv ou .xlsx.")

        return self._build_parsed_data(sections, known_players, provider_used=provider)

    def _read_csv_sections(self, raw_bytes: bytes) -> Dict[str, List[Dict[str, str]]]:
        text = _decode_csv_text(raw_bytes)
        sample = "\n".join(text.splitlines()[:15])
        delimiter = ";" if sample.count(";") > sample.count(",") else ","

        sections: Dict[str, List[Dict[str, str]]] = {
            "CABECALHO": [],
            "TIMES_JOGADORES": [],
            "PARTIDAS": [],
            "OUROS": [],
        }
        current_section: Optional[str] = None
        current_headers: Optional[List[str]] = None

        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        for raw_row in reader:
            row = [c.strip() for c in raw_row]
            if not any(row):
                continue

            first = row[0].strip().upper()
            if first.startswith("[") and first.endswith("]"):
                sec_name = first.strip("[]")
                current_section = sec_name if sec_name in sections else None
                current_headers = None
                continue

            if current_section is None:
                # Suporte caso o CSV comece diretamente por um cabeçalho conhecido sem tag [SECAO]
                norm_first = normalize_text(first)
                if norm_first == "DATA":
                    current_section = "CABECALHO"
                    current_headers = [normalize_text(c).lower().replace(" ", "_") for c in row]
                elif norm_first == "TIME SLOT":
                    current_section = "TIMES_JOGADORES"
                    current_headers = [normalize_text(c).lower().replace(" ", "_") for c in row]
                elif norm_first == "PARTIDA NUM":
                    current_section = "PARTIDAS"
                    current_headers = [normalize_text(c).lower().replace(" ", "_") for c in row]
                elif norm_first == "JOGADOR":
                    current_section = "OUROS"
                    current_headers = [normalize_text(c).lower().replace(" ", "_") for c in row]
                continue

            if current_headers is None:
                current_headers = [c.strip().lower() for c in row]
                continue

            row_dict = {
                current_headers[i]: (row[i] if i < len(row) else "")
                for i in range(len(current_headers))
                if current_headers[i]
            }
            sections[current_section].append(row_dict)

        return sections

    def _read_xlsx_sections(self, raw_bytes: bytes) -> Dict[str, List[Dict[str, Any]]]:
        wb = load_workbook(io.BytesIO(raw_bytes), data_only=True)
        sheet_map = {normalize_text(name).replace(" ", "_"): name for name in wb.sheetnames}

        def _sheet_to_dicts(target_keys: Sequence[str]) -> List[Dict[str, Any]]:
            for key in target_keys:
                if key in sheet_map:
                    ws = wb[sheet_map[key]]
                    rows = list(ws.iter_rows(values_only=True))
                    if not rows:
                        return []
                    headers = [_cell_str(h).lower() for h in rows[0]]
                    out: List[Dict[str, Any]] = []
                    for r in rows[1:]:
                        if not any(v is not None and str(v).strip() != "" for v in r):
                            continue
                        out.append({
                            headers[i]: (r[i] if i < len(r) else None)
                            for i in range(len(headers))
                            if headers[i]
                        })
                    return out
            return []

        return {
            "CABECALHO": _sheet_to_dicts(["CABECALHO", "HEADER"]),
            "TIMES_JOGADORES": _sheet_to_dicts(["TIMES_JOGADORES", "TIMES", "JOGADORES"]),
            "PARTIDAS": _sheet_to_dicts(["PARTIDAS", "MATCHES"]),
            "OUROS": _sheet_to_dicts(["OUROS"]),
        }

    def _build_parsed_data(
        self,
        sections: Dict[str, List[Dict[str, Any]]],
        known_players: Sequence[Tuple[int, str]],
        provider_used: str,
    ) -> SumulaParsedData:
        db_candidates = [(pid, name) for pid, name in known_players]
        warnings: List[str] = []

        # 1. Cabeçalho
        hdr_rows = sections.get("CABECALHO") or []
        hdr_row = hdr_rows[0] if hdr_rows else {}
        raw_date = _cell_str(hdr_row.get("data"))
        parsed_date = _parse_date_str(raw_date) or (raw_date if raw_date else None)
        header = SumulaHeader(
            date=parsed_date,
            baba_number=_cell_int(hdr_row.get("baba_numero"), 0) or None,
            total_goals=_cell_int(hdr_row.get("total_gols"), 0) or None,
            total_assists=_cell_int(hdr_row.get("total_assistencias"), 0) or None,
            location=normalize_text(_cell_str(hdr_row.get("local"))) or None,
            referee=normalize_text(_cell_str(hdr_row.get("juiz"))) or None,
        )

        # 2. Times e Jogadores (agrupados por time_slot 1..6)
        slot_rows: Dict[int, List[Dict[str, Any]]] = {i: [] for i in range(1, 7)}
        for row in sections.get("TIMES_JOGADORES") or []:
            slot = _cell_int(row.get("time_slot"), 0)
            name = _cell_str(row.get("nome"))
            if not (1 <= slot <= 6) or not name or _is_dash_text(name):
                continue
            slot_rows[slot].append(row)

        teams: List[SumulaTeamBlock] = []
        round_candidates: List[Tuple[Optional[int], str]] = []

        for slot in range(1, 7):
            rows_in_slot = slot_rows[slot]
            is_champion = any(_parse_bool(r.get("time_campeao")) for r in rows_in_slot)
            is_extra_only = len(rows_in_slot) == 1
            is_valid_team = len(rows_in_slot) >= 2

            players: List[SumulaPlayerRow] = []
            for idx, r in enumerate(rows_in_slot, start=1):
                pote_raw = _cell_str(r.get("pote_linha")).upper()
                if is_extra_only or pote_raw in {"6", "EXTRA", "E"} or idx == 6:
                    row_index = 6 if pote_raw == "6" or idx == 6 else idx
                    pote_val = None
                    is_extra = True
                else:
                    p_num = _cell_int(pote_raw, idx)
                    row_index = min(max(1, p_num), 5)
                    pote_val = row_index
                    is_extra = False

                raw_name = normalize_text(_cell_str(r.get("nome")))
                goals = _cell_int(r.get("gols"), 0)
                assists = _cell_int(r.get("assistencias"), 0)
                wins = _cell_int(r.get("vitorias"), 0)
                losses = _cell_int(r.get("derrotas"), 0)
                draws = _cell_int(r.get("empates"), 0)
                total_str = _cell_str(r.get("pontuacao_total"))
                raw_total, base_pts, extra_pts, total_pts = _parse_total_points(
                    total_str, goals=goals, assists=assists, wins=wins
                )

                pid, mname, conf = fuzzy_match_name(raw_name, db_candidates, min_score=0.70)
                players.append(
                    SumulaPlayerRow(
                        row_index=row_index,
                        pote=pote_val,
                        is_extra=is_extra,
                        raw_name=raw_name,
                        matched_player_id=pid,
                        matched_player_name=mname,
                        match_confidence=conf,
                        will_create_player=pid is None,
                        goals=goals,
                        assists=assists,
                        wins=wins,
                        losses=losses,
                        draws=draws,
                        raw_total=raw_total,
                        base_points=base_pts,
                        extra_points=extra_pts,
                        total_points=total_pts,
                    )
                )
                round_candidates.append((pid, mname or raw_name))

            team_name = None
            if is_valid_team and players:
                team_name = players[0].matched_player_name or players[0].raw_name

            teams.append(
                SumulaTeamBlock(
                    slot_index=slot,
                    team_name=team_name,
                    is_valid_team=is_valid_team,
                    is_extra_only=is_extra_only,
                    is_champion=is_champion,
                    players=players,
                )
            )

        valid_teams = [(t.slot_index, t.team_name or "") for t in teams if t.is_valid_team and t.team_name]
        all_candidates = round_candidates + db_candidates

        # 3. Partidas
        matches: List[SumulaMatchItem] = []
        total_match_goals = 0
        total_match_assists = 0

        for idx, r in enumerate(sections.get("PARTIDAS") or [], start=1):
            home_raw = _cell_str(r.get("time_casa"))
            away_raw = _cell_str(r.get("time_visitante"))
            if not home_raw or not away_raw or _is_dash_text(home_raw) or _is_dash_text(away_raw):
                continue

            match_num = _cell_int(r.get("partida_num"), idx)
            score_home = _cell_int(r.get("gols_casa"), 0)
            score_away = _cell_int(r.get("gols_visitante"), 0)

            h_slot, h_name, _ = fuzzy_match_name(home_raw, valid_teams, min_score=0.50)
            a_slot, a_name, _ = fuzzy_match_name(away_raw, valid_teams, min_score=0.50)

            goals_list: List[SumulaGoalAssistItem] = []
            for play_id in range(1, 6):
                g_raw = _cell_str(r.get(f"gol_{play_id}"))
                a_raw = _cell_str(r.get(f"assist_{play_id}"))
                if not g_raw or _is_dash_text(g_raw):
                    continue
                spid, sname, _ = fuzzy_match_name(g_raw, all_candidates, min_score=0.65)
                apid, aname = None, None
                if a_raw and not _is_dash_text(a_raw):
                    apid, aname, _ = fuzzy_match_name(a_raw, all_candidates, min_score=0.65)
                    if not aname:
                        aname = normalize_text(a_raw)
                    total_match_assists += 1
                goals_list.append(
                    SumulaGoalAssistItem(
                        play_id=play_id,
                        scorer_name=sname or normalize_text(g_raw),
                        scorer_player_id=spid,
                        assist_name=aname,
                        assist_player_id=apid,
                    )
                )

            total_match_goals += score_home + score_away
            cam_raw = _cell_str(r.get("camera"))
            cam_pid, cam_name = None, None
            if cam_raw and not _is_dash_text(cam_raw):
                cam_pid, cam_name, _ = fuzzy_match_name(cam_raw, all_candidates, min_score=0.65)
                if not cam_name:
                    cam_name = normalize_text(cam_raw)

            matches.append(
                SumulaMatchItem(
                    match_number=match_num,
                    home_team_name=h_name or normalize_text(home_raw),
                    away_team_name=a_name or normalize_text(away_raw),
                    home_team_slot=h_slot,
                    away_team_slot=a_slot,
                    score_home=score_home,
                    score_away=score_away,
                    goals=goals_list,
                    camera_name=cam_name,
                    camera_player_id=cam_pid,
                )
            )

        # 4. Ouros
        ouros: List[SumulaOuroItem] = []
        for r in sections.get("OUROS") or []:
            raw_name = _cell_str(r.get("jogador"))
            if not raw_name or _is_dash_text(raw_name):
                continue
            qty = _cell_int(r.get("quantidade"), 1)
            if qty <= 0:
                continue
            pid, pname, _ = fuzzy_match_name(raw_name, all_candidates, min_score=0.65)
            ouros.append(
                SumulaOuroItem(
                    raw_name=normalize_text(raw_name),
                    player_id=pid,
                    player_name=pname or normalize_text(raw_name),
                    count=qty,
                )
            )

        # Validações cruzadas
        if header.total_goals is not None and total_match_goals != header.total_goals:
            warnings.append(
                f"Soma de gols das partidas ({total_match_goals}) difere do cabeçalho ({header.total_goals})."
            )
        if header.total_assists is not None and total_match_assists != header.total_assists:
            warnings.append(
                f"Soma de assistências das partidas ({total_match_assists}) difere do cabeçalho ({header.total_assists})."
            )

        return SumulaParsedData(
            provider_used=provider_used,
            header=header,
            teams=teams,
            matches=matches,
            ouros=ouros,
            warnings=warnings,
        )
