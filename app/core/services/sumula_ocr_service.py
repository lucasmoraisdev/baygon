import base64
import json
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Sequence, Tuple

import cv2
import httpx
import numpy as np
from rapidocr_onnxruntime import RapidOCR

from app.config.settings import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_VISION_MODEL,
    SUMULA_VISION_PROVIDER,
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

_OCR_INSTANCE: Optional[RapidOCR] = None


def _get_rapidocr() -> RapidOCR:
    global _OCR_INSTANCE
    if _OCR_INSTANCE is None:
        _OCR_INSTANCE = RapidOCR()
    return _OCR_INSTANCE


def normalize_text(value: str) -> str:
    """Upper-cases, strips accents and normalizes whitespace."""
    if not value:
        return ""
    nfkd = unicodedata.normalize("NFKD", value)
    ascii_str = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^A-Z0-9.\- ]+", " ", ascii_str.upper())
    return re.sub(r"\s+", " ", cleaned).strip()


def _ocr_skeleton(value: str) -> str:
    """Normalizes common handwritten OCR character confusions for fuzzy matching."""
    s = normalize_text(value)
    replacements = {
        "0": "O",
        "1": "I",
        "3": "B",
        "5": "S",
        "6": "G",
        "8": "B",
        "2": "Z",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return re.sub(r"[^A-Z]", "", s)


def fuzzy_match_name(
    raw_name: str,
    candidates: Sequence[Tuple[Optional[int], str]],
    min_score: float = 0.56,
) -> Tuple[Optional[int], Optional[str], float]:
    """Matches an OCR name against a list of (player_id, display_name) candidates."""
    norm_raw = normalize_text(raw_name)
    if not norm_raw:
        return None, None, 0.0

    skel_raw = _ocr_skeleton(raw_name)
    best_id: Optional[int] = None
    best_name: Optional[str] = None
    best_score = 0.0

    for pid, cname in candidates:
        norm_cand = normalize_text(cname)
        if not norm_cand:
            continue
        if norm_raw == norm_cand:
            return pid, cname, 1.0

        skel_cand = _ocr_skeleton(cname)
        s1 = SequenceMatcher(None, norm_raw, norm_cand).ratio()
        s2 = SequenceMatcher(None, skel_raw, skel_cand).ratio() if skel_raw and skel_cand else 0.0
        sub_bonus = 0.0
        if len(skel_raw) >= 4 and (skel_raw in skel_cand or skel_cand in skel_raw):
            sub_bonus = 0.14

        score = min(1.0, max(s1, s2) + sub_bonus)
        if score > best_score:
            best_score = score
            best_id = pid
            best_name = cname

    if best_score >= min_score:
        return best_id, best_name, round(best_score, 3)
    return None, None, round(best_score, 3)


def _is_dash_text(text: str) -> bool:
    t = text.strip()
    if not t:
        return True
    return bool(re.fullmatch(r"[-—–_=~一.|/\\]+", t))


def _is_dash_cell_image(cell_bgr: np.ndarray) -> bool:
    """Detects a horizontal dash '—' drawn inside a cell by checking ink bounding-box geometry."""
    if cell_bgr.size == 0:
        return True
    gray = cv2.cvtColor(cell_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    inner = gray[2 : max(3, h - 2), 2 : max(3, w - 2)]
    if inner.size == 0:
        return True
    dark = inner < 155
    ys, xs = np.where(dark)
    if len(ys) < 4:
        return True
    ink_h = int(ys.max() - ys.min() + 1)
    ink_w = int(xs.max() - xs.min() + 1)
    if ink_h <= max(4, int(inner.shape[0] * 0.25)) and ink_w >= max(8, ink_h * 2.5):
        return True
    return False


def _parse_int_cell(text: str, default: int = 0) -> int:
    if not text or _is_dash_text(text):
        return default
    cleaned = text.strip().upper()
    trans = str.maketrans({"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2"})
    cleaned = cleaned.translate(trans)
    m = re.search(r"\d+", cleaned)
    return int(m.group(0)) if m else default


def _parse_total_points(
    text: str,
    goals: int = 0,
    assists: int = 0,
    wins: int = 0,
) -> Tuple[Optional[str], int, int, int]:
    """Parses totals like '38+3' -> (raw_total, base=38, extra=3, total=41)."""
    if not text or _is_dash_text(text):
        return None, 0, 0, 0
    raw = text.strip()
    cleaned = raw.upper().replace(" ", "")
    trans = str.maketrans({"O": "0", "D": "0", "I": "1", "L": "1", "S": "5", "B": "8"})

    # Explicit "A+B" or "AtB" (e.g. "33t3" when '+' is read as 't')
    m = re.search(r"([0-9ODILSB]+)[+T]([0-9ODILSB]+)", cleaned)
    if m:
        base = int(m.group(1).translate(trans))
        extra = int(m.group(2).translate(trans))
        return f"{base}+{extra}", base, extra, base + extra

    # Heuristic: OCR sometimes reads '+' as '4' (e.g. '38+3' -> '3843' or '24+3' -> '2443')
    digits_only = re.sub(r"[^0-9]", "", cleaned.translate(trans))
    if len(digits_only) == 4 and digits_only[2] == "4":
        cand_base = int(digits_only[:2])
        cand_extra = int(digits_only[3])
        return f"{cand_base}+{cand_extra}", cand_base, cand_extra, cand_base + cand_extra

    m_single = re.search(r"\d+", cleaned.translate(trans))
    if m_single:
        val = int(m_single.group(0))
        return str(val), val, 0, val

    return raw, 0, 0, 0


def _parse_date_str(raw: str) -> Optional[str]:
    """Converts DD/MM/YY or DD/MM/YYYY (with OCR digit fixes) to YYYY-MM-DD."""
    if not raw:
        return None
    trans = str.maketrans({"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2"})
    fixed = raw.upper().translate(trans)
    m = re.search(r"(\d{1,2})\s*[/\-]\s*(\d{1,2})\s*[/\-]\s*(\d{2,4})", fixed)
    if not m:
        return None
    day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if year < 100:
        year += 2000
    if 1 <= month <= 12 and 1 <= day <= 31:
        return f"{year:04d}-{month:02d}-{day:02d}"
    return None


def _parse_ouro_count(token: str) -> int:
    t = token.strip().upper()
    if not t:
        return 1
    if re.fullmatch(r"[I1L|!]+", t):
        return len(t)
    m = re.search(r"\d+", t)
    if m:
        return max(1, int(m.group(0)))
    return 1


def _find_line_peaks(proj: np.ndarray, ratio: float, min_dist: int) -> List[int]:
    idxs = np.where(proj > ratio)[0]
    groups: List[List[int]] = []
    for i in idxs:
        if not groups or i - groups[-1][-1] > min_dist:
            groups.append([int(i)])
        else:
            groups[-1].append(int(i))
    return [int(np.mean(g)) for g in groups]


def _complete_uniform_grid_lines(
    detected: List[int],
    expected_intervals: int,
    fallback_start: int,
    fallback_end: int,
) -> List[int]:
    """Fills any missing interior grid lines assuming uniform row spacing."""
    if len(detected) >= expected_intervals + 1:
        return detected
    if len(detected) < 2:
        step = (fallback_end - fallback_start) / expected_intervals
        return [int(round(fallback_start + i * step)) for i in range(expected_intervals + 1)]

    diffs = [detected[i + 1] - detected[i] for i in range(len(detected) - 1)]
    small_diffs = [d for d in diffs if d > 6]
    if not small_diffs:
        step = (detected[-1] - detected[0]) / expected_intervals
        return [int(round(detected[0] + i * step)) for i in range(expected_intervals + 1)]

    median_step = float(np.percentile(small_diffs, 35))
    if median_step < 8:
        median_step = (detected[-1] - detected[0]) / expected_intervals

    filled = [detected[0]]
    for nxt in detected[1:]:
        gap = nxt - filled[-1]
        if gap > median_step * 1.45:
            n_sub = max(2, int(round(gap / median_step)))
            sub_step = gap / n_sub
            for k in range(1, n_sub):
                filled.append(int(round(filled[-1] + sub_step)))
        filled.append(nxt)

    while len(filled) < expected_intervals + 1 and filled[-1] + median_step <= fallback_end + 8:
        filled.append(int(round(filled[-1] + median_step)))
    return filled


def _deskew_image(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    w = img.shape[1]
    h = img.shape[0]
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=max(120, w // 6), minLineLength=w // 3, maxLineGap=20
    )
    angles = []
    if lines is not None:
        for x1, y1, x2, y2 in lines.reshape(-1, 4):
            ang = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            if abs(ang) < 7.0:
                angles.append(ang)
    if not angles:
        return img
    angle = float(np.median(angles))
    if abs(angle) < 0.15:
        return img
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(img, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _extract_grid_lines(
    roi: np.ndarray,
    h_ratio: float = 0.22,
    v_ratio: float = 0.25,
    h_frac: int = 8,
    v_frac: int = 4,
) -> Tuple[List[int], List[int]]:
    th, tw = roi.shape[:2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 10
    )
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(10, tw // h_frac), 1))
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(10, th // v_frac)))
    h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, h_kernel)
    v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, v_kernel)
    rows = _find_line_peaks(np.sum(h_lines > 0, axis=1) / max(tw, 1), h_ratio, 10)
    cols = _find_line_peaks(np.sum(v_lines > 0, axis=0) / max(th, 1), v_ratio, 12)
    return rows, cols


class SumulaOCRService:
    """Extrai dados estruturados da imagem de súmula (RapidOCR local + provedores VLM opcionais)."""

    EXTRACTION_PROMPT = """Você é um extrator preciso de dados de uma súmula de futebol (baba).
Analise a imagem da súmula e retorne EXCLUSIVAMENTE um JSON válido (sem markdown) no seguinte formato:
{
  "header": {
    "date": "YYYY-MM-DD",
    "baba_number": 1,
    "total_goals": 51,
    "total_assists": 37,
    "location": "ARENA BAYGON",
    "referee": "CRUZ"
  },
  "teams": [
    {
      "slot_index": 1,
      "team_name": "DIEGO",
      "is_champion": false,
      "players": [
        {
          "row_index": 1,
          "raw_name": "DIEGO",
          "goals": 4,
          "assists": 3,
          "wins": 3,
          "losses": 5,
          "draws": 0,
          "raw_total": "17+3",
          "base_points": 17,
          "extra_points": 3,
          "total_points": 20
        }
      ]
    }
  ],
  "matches": [
    {
      "match_number": 1,
      "home_team_name": "DIEGO",
      "away_team_name": "RICK",
      "score_home": 0,
      "score_away": 1,
      "goals": [
        {"play_id": 1, "scorer_name": "GB", "assist_name": "PIROCA"}
      ],
      "camera_name": "ADILSON"
    }
  ],
  "ouros": [
    {"raw_name": "TUTA", "count": 1},
    {"raw_name": "CABREIRO", "count": 2}
  ]
}
Regras obrigatórias:
1. Ignore linhas vazias ou preenchidas apenas com traços (—). Se não houver assistência em um gol, use null em assist_name.
2. As 6 tabelas menores de times seguem a ordem:
   slot 1 = topo esquerda, slot 2 = baixo esquerda, slot 3 = topo meio, slot 4 = baixo meio, slot 5 = topo direita, slot 6 = baixo direita.
3. Se uma tabela de time tiver pontuação "38+3", preencha raw_total="38+3", base_points=38, extra_points=3, total_points=41.
4. Se alguma tabela tiver marcação "* CAMPEÕES", marque is_champion=true.
5. No rodapé "OUROS:", conte os riscos (I = 1, II = 2, III = 3).
"""

    async def extract_from_image(
        self,
        image_bytes: bytes,
        known_players: Sequence[Tuple[int, str]] = (),
        provider: str = "auto",
    ) -> SumulaParsedData:
        chosen = self._resolve_provider(provider)
        if chosen == "ollama":
            parsed = await self._extract_with_ollama(image_bytes)
        elif chosen == "gemini":
            parsed = await self._extract_with_gemini(image_bytes)
        elif chosen == "openai":
            parsed = await self._extract_with_openai(image_bytes)
        else:
            parsed = self._extract_with_rapidocr(image_bytes, known_players)

        return self._reconcile_and_validate(parsed, known_players)

    def _resolve_provider(self, provider: str) -> str:
        p = (provider or SUMULA_VISION_PROVIDER or "auto").lower().strip()
        if p != "auto":
            return p
        if OLLAMA_BASE_URL:
            return "ollama"
        if GEMINI_API_KEY:
            return "gemini"
        if OPENAI_API_KEY:
            return "openai"
        return "rapidocr"

    # ------------------------------------------------------------------
    # Local Open-Source OpenCV + RapidOCR Engine (grid-whiteout + 2x OCR)
    # ------------------------------------------------------------------
    def _extract_with_rapidocr(
        self,
        image_bytes: bytes,
        known_players: Sequence[Tuple[int, str]],
    ) -> SumulaParsedData:
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Não foi possível decodificar a imagem enviada.")

        deskewed = _deskew_image(img)
        h, w = deskewed.shape[:2]
        ocr = _get_rapidocr()

        # Detect table grid lines and remove them on a clean copy for OCR
        gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 10
        )
        hk = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, w // 30), 1))
        vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(15, h // 30)))
        h_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, hk)
        v_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vk)
        grid = cv2.bitwise_or(h_lines, v_lines)
        grid_dilated = cv2.dilate(grid, np.ones((3, 3), np.uint8), iterations=1)

        contours, _ = cv2.findContours(grid_dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        matches_box: Optional[Tuple[int, int, int, int]] = None
        lower_boxes: List[Tuple[int, int, int, int]] = []
        for cnt in contours:
            x, y, bw, bh = cv2.boundingRect(cnt)
            if bw > w * 0.55 and bh > h * 0.22 and y < h * 0.55:
                if matches_box is None or bw * bh > matches_box[2] * matches_box[3]:
                    matches_box = (x, y, bw, bh)
            elif bw > w * 0.14 and bh > h * 0.08 and y >= h * 0.45:
                lower_boxes.append((x, y, bw, bh))

        if matches_box is None:
            matches_box = (int(w * 0.04), int(h * 0.12), int(w * 0.92), int(h * 0.45))

        mx, my, mw, mh = matches_box

        # Run RapidOCR once on 2x grid-whiteout deskewed image
        clean = deskewed.copy()
        clean[grid_dilated > 0] = (255, 255, 255)
        up = cv2.resize(clean, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        raw_detections, _ = ocr(up)

        detections: List[Tuple[float, float, float, float, float, float, str]] = []
        if raw_detections:
            for box, txt, _conf in raw_detections:
                xs = [p[0] / 2.0 for p in box]
                ys = [p[1] / 2.0 for p in box]
                detections.append(
                    (min(xs), min(ys), max(xs), max(ys), sum(xs) / 4.0, sum(ys) / 4.0, txt.strip())
                )

        # 1. Header
        header = self._parse_header_from_detections(detections, my)

        # 2. Lower 6 team tables
        lower_y1 = my + mh + 2
        if lower_boxes:
            lower_y2 = min(h - 10, max(y + bh for _, y, _, bh in lower_boxes) + 8)
            min_lx = max(0, min(x for x, _, _, _ in lower_boxes) - 8)
            max_lx = min(w, max(x + bw for x, _, bw, _ in lower_boxes) + 8)
        else:
            lower_y2 = int(h * 0.94)
            min_lx, max_lx = int(w * 0.02), int(w * 0.98)

        teams = self._parse_six_team_tables(
            ocr, deskewed, detections, lower_y1, lower_y2, min_lx, max_lx, known_players
        )

        # Combined player candidates (extracted teams + DB players)
        round_candidates: List[Tuple[Optional[int], str]] = []
        for t in teams:
            for p in t.players:
                round_candidates.append((p.matched_player_id, p.matched_player_name or p.raw_name))
        combined_candidates = round_candidates + [(pid, name) for pid, name in known_players]

        # 3. Big matches table
        matches = self._parse_matches_table(
            ocr, deskewed, detections, matches_box, teams, combined_candidates
        )

        # 4. Footer OUROS
        ouros = self._parse_ouros_from_detections(detections, lower_y2, combined_candidates)

        return SumulaParsedData(
            provider_used="rapidocr",
            header=header,
            teams=teams,
            matches=matches,
            ouros=ouros,
            warnings=[],
        )

    def _parse_header_from_detections(
        self,
        detections: Sequence[Tuple[float, float, float, float, float, float, str]],
        matches_y1: int,
    ) -> SumulaHeader:
        header_items = [d for d in detections if d[5] < matches_y1 + 5]
        header_items.sort(key=lambda d: (round(d[5] / 15), d[4]))
        full_text = " ".join(d[6] for d in header_items)
        upper = full_text.upper()

        date_val = _parse_date_str(upper)

        baba_num: Optional[int] = None
        m_baba = re.search(r"BABA\s*N[º°O\"']?\s*[:\-]?\s*([0-9OIL]{1,3})", upper)
        if m_baba:
            baba_num = _parse_int_cell(m_baba.group(1), 0) or None

        total_goals: Optional[int] = None
        m_goals = re.search(r"GOLS?\s*[:\-]?\s*([0-9OILSB]{1,3})", upper)
        if m_goals:
            total_goals = _parse_int_cell(m_goals.group(1), 0) or None

        total_assists: Optional[int] = None
        m_ass = re.search(r"ASSIST[EÊ]NCIAS?\s*[:\-]?\s*([0-9OILSB]{1,3})", upper)
        if m_ass:
            total_assists = _parse_int_cell(m_ass.group(1), 0) or None

        location: Optional[str] = None
        m_loc = re.search(r"LOCAL\s*[:\-_]?\s*([A-Z0-9 ]+?)(?=\s+JUIZ|\s+BOLA|$)", upper)
        if m_loc:
            location = m_loc.group(1).strip(" _:-")

        referee: Optional[str] = None
        m_ref = re.search(r"JUIZ\s*[:\-_]?\s*([A-Z0-9]+)", upper)
        if m_ref:
            referee = m_ref.group(1).strip(" _:-")

        return SumulaHeader(
            date=date_val,
            baba_number=baba_num,
            total_goals=total_goals,
            total_assists=total_assists,
            location=location,
            referee=referee,
        )

    def _parse_six_team_tables(
        self,
        ocr: RapidOCR,
        deskewed: np.ndarray,
        detections: Sequence[Tuple[float, float, float, float, float, float, str]],
        y1_reg: int,
        y2_reg: int,
        x1_reg: int,
        x2_reg: int,
        known_players: Sequence[Tuple[int, str]],
    ) -> List[SumulaTeamBlock]:
        region = deskewed[y1_reg:y2_reg, x1_reg:x2_reg]
        rh, rw = region.shape[:2]
        if rh < 40 or rw < 60:
            return []

        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 10
        )
        mid_y_band = thresh[int(rh * 0.38) : int(rh * 0.62), :]
        row_split = int(rh * 0.38) + int(np.argmin(np.sum(mid_y_band > 0, axis=1)))

        col_splits = [0]
        for frac in (0.33, 0.66):
            c_start = int(rw * (frac - 0.06))
            c_end = int(rw * (frac + 0.06))
            v_ink = np.sum(thresh[:, c_start:c_end] > 0, axis=0)
            col_splits.append(c_start + int(np.argmin(v_ink)))
        col_splits.append(rw)

        row_bands = [(0, row_split), (row_split, rh)]
        slot_coords = [
            (1, 0, 0),
            (2, 1, 0),
            (3, 0, 1),
            (4, 1, 1),
            (5, 0, 2),
            (6, 1, 2),
        ]

        champ_points = [
            (d[4], d[5])
            for d in detections
            if y1_reg - 20 <= d[5] <= y2_reg and ("CAMPE" in normalize_text(d[6]) or "COMPE" in normalize_text(d[6]))
        ]

        db_candidates = [(pid, name) for pid, name in known_players]
        blocks: List[SumulaTeamBlock] = []

        for slot_idx, r_band_idx, c_band_idx in slot_coords:
            ry1_local, ry2_local = row_bands[r_band_idx]
            rx1_local, rx2_local = col_splits[c_band_idx], col_splits[c_band_idx + 1]
            sub = region[ry1_local:ry2_local, rx1_local:rx2_local]
            abs_x0 = x1_reg + rx1_local
            abs_y0 = y1_reg + ry1_local

            rows, cols = _extract_grid_lines(sub, h_ratio=0.22, v_ratio=0.25, h_frac=5, v_frac=4)
            if len(cols) > 8:
                cols = cols[-8:]

            # Locate the header row containing "NOME" or "TOTAL" so extra text above (like "* CAMPEÕES") doesn't shift row 0
            header_row_idx = 0
            if len(rows) >= 2:
                for ri in range(min(3, len(rows) - 1)):
                    hy1, hy2 = abs_y0 + rows[ri], abs_y0 + rows[ri + 1]
                    row_txt = " ".join(
                        d[6] for d in detections
                        if abs_x0 <= d[4] <= abs_x0 + sub.shape[1] and hy1 - 3 <= d[5] <= hy2 + 3
                    )
                    if "NOME" in normalize_text(row_txt) or "TOTAL" in normalize_text(row_txt):
                        header_row_idx = ri
                        break
                rows = rows[header_row_idx:]
                rows = _complete_uniform_grid_lines(rows, 7, rows[0], rows[-1])
            else:
                rows = _complete_uniform_grid_lines([], 7, 10, max(20, sub.shape[0] - 8))

            is_champion = any(
                abs_x0 <= cx <= abs_x0 + sub.shape[1] and abs_y0 - 25 <= cy <= abs_y0 + sub.shape[0]
                for cx, cy in champ_points
            )

            players: List[SumulaPlayerRow] = []
            if len(cols) >= 8 and len(rows) >= 2:
                # Collect cells needing batch recognizer fallback (numeric cells missed by global det)
                rec_crops: List[np.ndarray] = []
                rec_meta: List[Tuple[int, int]] = []
                cell_texts: Dict[Tuple[int, int], str] = {}

                for r_idx in range(1, min(7, len(rows) - 1)):
                    cy1, cy2 = abs_y0 + rows[r_idx], abs_y0 + rows[r_idx + 1]
                    for c_idx in range(7):
                        cx1, cx2 = abs_x0 + cols[c_idx], abs_x0 + cols[c_idx + 1]
                        matched = [
                            d[6] for d in detections
                            if cx1 <= d[4] < cx2 and cy1 <= d[5] < cy2
                        ]
                        txt = " ".join(matched).strip()
                        cell_texts[(r_idx, c_idx)] = txt
                        if not txt:
                            cell_img = sub[rows[r_idx] + 2 : rows[r_idx + 1] - 2, cols[c_idx] + 2 : cols[c_idx + 1] - 2]
                            if cell_img.size > 0 and not _is_dash_cell_image(cell_img):
                                ch, cw = cell_img.shape[:2]
                                sc = 36.0 / max(ch, 1)
                                rsz = cv2.resize(cell_img, (max(12, int(cw * sc)), 36), interpolation=cv2.INTER_CUBIC)
                                pad = cv2.copyMakeBorder(rsz, 6, 6, 12, 12, cv2.BORDER_CONSTANT, value=(255, 255, 255))
                                rec_crops.append(pad)
                                rec_meta.append((r_idx, c_idx))

                if rec_crops:
                    rec_res, _ = ocr.text_recognizer(rec_crops)
                    for (ri, ci), (rtxt, rscore) in zip(rec_meta, rec_res):
                        if float(rscore) >= 0.18 and rtxt.strip() and not _is_dash_text(rtxt):
                            cell_texts[(ri, ci)] = rtxt.strip()

                for r_idx in range(1, min(7, len(rows) - 1)):
                    raw_name = cell_texts.get((r_idx, 0), "")
                    if not raw_name or _is_dash_text(raw_name):
                        continue

                    goals = _parse_int_cell(cell_texts.get((r_idx, 1), ""))
                    assists = _parse_int_cell(cell_texts.get((r_idx, 2), ""))
                    wins = _parse_int_cell(cell_texts.get((r_idx, 3), ""))
                    losses = _parse_int_cell(cell_texts.get((r_idx, 4), ""))
                    draws = _parse_int_cell(cell_texts.get((r_idx, 5), ""))
                    total_txt = cell_texts.get((r_idx, 6), "")
                    raw_total, base_pts, extra_pts, total_pts = _parse_total_points(
                        total_txt, goals=goals, assists=assists, wins=wins
                    )

                    pid, matched_name, conf = fuzzy_match_name(raw_name, db_candidates)
                    is_extra_row = r_idx == 6
                    players.append(
                        SumulaPlayerRow(
                            row_index=r_idx,
                            pote=None if is_extra_row else r_idx,
                            is_extra=is_extra_row,
                            raw_name=normalize_text(raw_name),
                            matched_player_id=pid,
                            matched_player_name=matched_name,
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

            is_extra_only = len(players) == 1
            is_valid_team = len(players) >= 2
            if is_extra_only:
                players[0].is_extra = True
                players[0].pote = None

            team_name = None
            if is_valid_team and players:
                team_name = players[0].matched_player_name or players[0].raw_name

            blocks.append(
                SumulaTeamBlock(
                    slot_index=slot_idx,
                    team_name=team_name,
                    is_valid_team=is_valid_team,
                    is_extra_only=is_extra_only,
                    is_champion=is_champion,
                    players=players,
                )
            )

        return blocks

    def _parse_matches_table(
        self,
        ocr: RapidOCR,
        deskewed: np.ndarray,
        detections: Sequence[Tuple[float, float, float, float, float, float, str]],
        matches_box: Tuple[int, int, int, int],
        teams: List[SumulaTeamBlock],
        candidates: Sequence[Tuple[Optional[int], str]],
    ) -> List[SumulaMatchItem]:
        mx, my, mw, mh = matches_box
        roi = deskewed[my : my + mh, mx : mx + mw]
        rows, cols = _extract_grid_lines(roi, h_ratio=0.20, v_ratio=0.25, h_frac=12, v_frac=6)
        if len(cols) < 14:
            cols = _complete_uniform_grid_lines(cols, 13, 0, mw)
        rows = _complete_uniform_grid_lines(rows, 21, rows[0] if rows else 0, mh)

        team_candidates: List[Tuple[Optional[int], str]] = [
            (t.slot_index, t.team_name)
            for t in teams
            if t.is_valid_team and t.team_name
        ]
        for t in teams:
            if t.is_valid_team and t.players:
                team_candidates.append((t.slot_index, t.players[0].raw_name))

        matches: List[SumulaMatchItem] = []
        for r_idx in range(1, min(21, len(rows) - 1)):
            ry1, ry2 = my + rows[r_idx], my + rows[r_idx + 1]

            def _cell_txt(c_idx: int) -> str:
                if c_idx + 1 >= len(cols):
                    return ""
                cx1, cx2 = mx + cols[c_idx], mx + cols[c_idx + 1]
                items = [
                    d for d in detections
                    if cx1 <= d[4] < cx2 and ry1 <= d[5] < ry2
                ]
                items.sort(key=lambda d: d[4])
                return " ".join(d[6] for d in items).strip()

            match_txt = _cell_txt(1)
            parsed_score = self._parse_match_score_cell(match_txt, team_candidates)
            if not parsed_score:
                # Retry OCR directly on original (non-whiteout) PARTIDAS cell crop
                p_cell = deskewed[ry1 + 1 : ry2 - 1, mx + cols[1] + 2 : mx + cols[2] - 2]
                if p_cell.size > 0 and not _is_dash_cell_image(p_cell):
                    p_up = cv2.resize(p_cell, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
                    p_pad = cv2.copyMakeBorder(p_up, 12, 12, 12, 12, cv2.BORDER_CONSTANT, value=(255, 255, 255))
                    p_res, _ = ocr(p_pad)
                    if p_res:
                        p_res.sort(key=lambda item: sum(pt[0] for pt in item[0]))
                        retry_txt = " ".join(item[1].strip() for item in p_res)
                        parsed_score = self._parse_match_score_cell(retry_txt, team_candidates)
            if not parsed_score:
                continue

            home_name, home_slot, score_home, score_away, away_name, away_slot = parsed_score

            goals_list: List[SumulaGoalAssistItem] = []
            for play_idx in range(5):
                g_txt = _cell_txt(2 + play_idx * 2)
                a_txt = _cell_txt(3 + play_idx * 2)
                if g_txt and not _is_dash_text(g_txt):
                    spid, sname, _ = fuzzy_match_name(g_txt, candidates)
                    apid, aname = None, None
                    if a_txt and not _is_dash_text(a_txt):
                        apid, aname, _ = fuzzy_match_name(a_txt, candidates)
                        if not aname:
                            aname = normalize_text(a_txt)
                    goals_list.append(
                        SumulaGoalAssistItem(
                            play_id=play_idx + 1,
                            scorer_name=sname or normalize_text(g_txt),
                            scorer_player_id=spid,
                            assist_name=aname,
                            assist_player_id=apid,
                        )
                    )

            cam_txt = _cell_txt(12)
            cam_pid, cam_name, _ = fuzzy_match_name(cam_txt, candidates) if cam_txt and not _is_dash_text(cam_txt) else (None, None, 0.0)

            matches.append(
                SumulaMatchItem(
                    match_number=r_idx,
                    home_team_name=home_name,
                    away_team_name=away_name,
                    home_team_slot=home_slot,
                    away_team_slot=away_slot,
                    score_home=score_home,
                    score_away=score_away,
                    goals=goals_list,
                    camera_name=cam_name or (normalize_text(cam_txt) if cam_txt and not _is_dash_text(cam_txt) else None),
                    camera_player_id=cam_pid,
                )
            )

        return matches

    def _parse_match_score_cell(
        self,
        text: str,
        team_candidates: Sequence[Tuple[Optional[int], str]],
    ) -> Optional[Tuple[str, Optional[int], int, int, str, Optional[int]]]:
        if not text:
            return None
        cleaned = normalize_text(text)
        m = re.search(
            r"\(?\s*([A-Z0-9. ]+?)\s*\)?\s*(\d|[ODQILSB])\s*[X×]\s*(\d|[ODQILSB])\s*\(?\s*([A-Z0-9. ]+?)\s*\)?$",
            cleaned,
        )
        if not m:
            return None

        raw_home, s_home_raw, s_away_raw, raw_away = (
            m.group(1).strip(),
            m.group(2),
            m.group(3),
            m.group(4).strip(),
        )
        if _is_dash_text(raw_home) or _is_dash_text(raw_away):
            return None

        score_home = _parse_int_cell(s_home_raw, 0)
        score_away = _parse_int_cell(s_away_raw, 0)

        h_slot, h_name, _ = fuzzy_match_name(raw_home, team_candidates, min_score=0.45)
        a_slot, a_name, _ = fuzzy_match_name(raw_away, team_candidates, min_score=0.45)

        return (
            h_name or raw_home,
            h_slot,
            score_home,
            score_away,
            a_name or raw_away,
            a_slot,
        )

    def _parse_ouros_from_detections(
        self,
        detections: Sequence[Tuple[float, float, float, float, float, float, str]],
        lower_y2: int,
        candidates: Sequence[Tuple[Optional[int], str]],
    ) -> List[SumulaOuroItem]:
        footer_items = [d for d in detections if d[5] > lower_y2 - 12]
        if not footer_items:
            return []
        footer_items.sort(key=lambda d: d[4])
        raw_line = " ".join(d[6] for d in footer_items)
        raw_line = re.sub(r"^.*?OUROS?\s*[:\-]?\s*", "", raw_line, flags=re.IGNORECASE)
        parts = re.split(r"[|/]+", raw_line)
        items: List[SumulaOuroItem] = []
        for part in parts:
            part = part.strip(" ._-")
            if not part or _is_dash_text(part):
                continue
            # Handle leading '+' read instead of 'T' (e.g. "+UTA.I" -> "TUTA I")
            if part.startswith("+"):
                part = "T" + part[1:]
            m = re.match(r"^([A-Za-zÀ-ÿ0-9. ]+?)\s*[:.\-]?\s*([I1lL|!]+|\d+)?$", part)
            if not m:
                continue
            raw_name = normalize_text(m.group(1))
            if not raw_name or len(raw_name) < 2:
                continue
            count = _parse_ouro_count(m.group(2) or "I")
            pid, pname, _ = fuzzy_match_name(raw_name, candidates)
            items.append(
                SumulaOuroItem(
                    raw_name=raw_name,
                    player_id=pid,
                    player_name=pname or raw_name,
                    count=count,
                )
            )
        return items

    # ------------------------------------------------------------------
    # Optional Vision LLM Providers (Ollama local open-source, Gemini, OpenAI)
    # ------------------------------------------------------------------
    async def _extract_with_ollama(self, image_bytes: bytes) -> SumulaParsedData:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        payload = {
            "model": OLLAMA_MODEL,
            "stream": False,
            "format": "json",
            "messages": [
                {
                    "role": "user",
                    "content": self.EXTRACTION_PROMPT,
                    "images": [b64],
                }
            ],
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        raw_content = data.get("message", {}).get("content", "{}")
        return self._parsed_from_json(raw_content, provider_used=f"ollama:{OLLAMA_MODEL}")

    async def _extract_with_gemini(self, image_bytes: bytes) -> SumulaParsedData:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": self.EXTRACTION_PROMPT},
                        {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
                    ]
                }
            ],
            "generationConfig": {"response_mime_type": "application/json"},
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
        raw_content = data["candidates"][0]["content"]["parts"][0]["text"]
        return self._parsed_from_json(raw_content, provider_used=f"gemini:{GEMINI_MODEL}")

    async def _extract_with_openai(self, image_bytes: bytes) -> SumulaParsedData:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        url = f"{OPENAI_BASE_URL.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
        payload = {
            "model": OPENAI_VISION_MODEL,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self.EXTRACTION_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                        },
                    ],
                }
            ],
        }
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        raw_content = data["choices"][0]["message"]["content"]
        return self._parsed_from_json(raw_content, provider_used=f"openai:{OPENAI_VISION_MODEL}")

    def _parsed_from_json(self, raw_json: str, provider_used: str) -> SumulaParsedData:
        cleaned = raw_json.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.DOTALL)
        obj: Dict[str, Any] = json.loads(cleaned)

        header = SumulaHeader(**(obj.get("header") or {}))
        teams: List[SumulaTeamBlock] = []
        for t in obj.get("teams") or []:
            raw_players = t.get("players") or []
            is_extra_only = len(raw_players) == 1
            is_valid_team = len(raw_players) >= 2
            players: List[SumulaPlayerRow] = []
            for idx, p in enumerate(raw_players, start=1):
                r_idx = int(p.get("row_index") or idx)
                is_extra = is_extra_only or r_idx == 6
                raw_total = p.get("raw_total")
                base_pts = int(p.get("base_points") or 0)
                extra_pts = int(p.get("extra_points") or 0)
                total_pts = int(p.get("total_points") or (base_pts + extra_pts))
                if raw_total and "+" in str(raw_total) and extra_pts == 0:
                    _, base_pts, extra_pts, total_pts = _parse_total_points(str(raw_total))
                players.append(
                    SumulaPlayerRow(
                        row_index=r_idx,
                        pote=None if is_extra else r_idx,
                        is_extra=is_extra,
                        raw_name=normalize_text(p.get("raw_name", "")),
                        goals=int(p.get("goals") or 0),
                        assists=int(p.get("assists") or 0),
                        wins=int(p.get("wins") or 0),
                        losses=int(p.get("losses") or 0),
                        draws=int(p.get("draws") or 0),
                        raw_total=raw_total,
                        base_points=base_pts,
                        extra_points=extra_pts,
                        total_points=total_pts,
                    )
                )
            teams.append(
                SumulaTeamBlock(
                    slot_index=int(t.get("slot_index") or len(teams) + 1),
                    team_name=normalize_text(t.get("team_name") or (players[0].raw_name if is_valid_team and players else "")),
                    is_valid_team=is_valid_team,
                    is_extra_only=is_extra_only,
                    is_champion=bool(t.get("is_champion", False)),
                    players=players,
                )
            )

        matches: List[SumulaMatchItem] = []
        for m in obj.get("matches") or []:
            goals = [
                SumulaGoalAssistItem(
                    play_id=int(g.get("play_id") or idx + 1),
                    scorer_name=normalize_text(g.get("scorer_name", "")),
                    assist_name=normalize_text(g["assist_name"]) if g.get("assist_name") else None,
                )
                for idx, g in enumerate(m.get("goals") or [])
                if g.get("scorer_name") and not _is_dash_text(g.get("scorer_name", ""))
            ]
            matches.append(
                SumulaMatchItem(
                    match_number=int(m.get("match_number") or len(matches) + 1),
                    home_team_name=normalize_text(m.get("home_team_name", "")),
                    away_team_name=normalize_text(m.get("away_team_name", "")),
                    score_home=int(m.get("score_home") or 0),
                    score_away=int(m.get("score_away") or 0),
                    goals=goals,
                    camera_name=normalize_text(m["camera_name"]) if m.get("camera_name") else None,
                )
            )

        ouros = [
            SumulaOuroItem(
                raw_name=normalize_text(o.get("raw_name", "")),
                count=int(o.get("count") or 1),
            )
            for o in obj.get("ouros") or []
            if o.get("raw_name")
        ]

        return SumulaParsedData(
            provider_used=provider_used,
            header=header,
            teams=teams,
            matches=matches,
            ouros=ouros,
            warnings=[],
        )

    # ------------------------------------------------------------------
    # Reconciliation against DB players & Cross-validation
    # ------------------------------------------------------------------
    def _reconcile_and_validate(
        self,
        parsed: SumulaParsedData,
        known_players: Sequence[Tuple[int, str]],
    ) -> SumulaParsedData:
        db_candidates = [(pid, name) for pid, name in known_players]
        warnings = list(parsed.warnings)

        round_candidates: List[Tuple[Optional[int], str]] = []
        for team in parsed.teams:
            team.is_extra_only = len(team.players) == 1
            team.is_valid_team = len(team.players) >= 2
            for p in team.players:
                p.is_extra = team.is_extra_only or p.row_index == 6
                p.pote = None if p.is_extra else p.row_index
                if p.matched_player_id is None:
                    pid, mname, conf = fuzzy_match_name(p.raw_name, db_candidates)
                    p.matched_player_id = pid
                    p.matched_player_name = mname
                    p.match_confidence = conf
                p.will_create_player = p.matched_player_id is None
                round_candidates.append((p.matched_player_id, p.matched_player_name or p.raw_name))

            if team.is_valid_team and team.players and not team.team_name:
                team.team_name = team.players[0].matched_player_name or team.players[0].raw_name

        valid_teams = [(t.slot_index, t.team_name or "") for t in parsed.teams if t.is_valid_team and t.team_name]
        all_candidates = round_candidates + [(pid, name) for pid, name in known_players]

        total_match_goals = 0
        total_match_assists = 0
        for m in parsed.matches:
            if m.home_team_slot is None and valid_teams:
                slot, name, _ = fuzzy_match_name(m.home_team_name, valid_teams, min_score=0.45)
                m.home_team_slot = slot
                if name:
                    m.home_team_name = name
            if m.away_team_slot is None and valid_teams:
                slot, name, _ = fuzzy_match_name(m.away_team_name, valid_teams, min_score=0.45)
                m.away_team_slot = slot
                if name:
                    m.away_team_name = name

            total_match_goals += m.score_home + m.score_away
            for g in m.goals:
                if g.scorer_player_id is None:
                    pid, name, _ = fuzzy_match_name(g.scorer_name, all_candidates)
                    g.scorer_player_id = pid
                    if name:
                        g.scorer_name = name
                if g.assist_name:
                    total_match_assists += 1
                    if g.assist_player_id is None:
                        pid, name, _ = fuzzy_match_name(g.assist_name, all_candidates)
                        g.assist_player_id = pid
                        if name:
                            g.assist_name = name

            if m.camera_name and m.camera_player_id is None:
                pid, name, _ = fuzzy_match_name(m.camera_name, all_candidates)
                m.camera_player_id = pid
                if name:
                    m.camera_name = name

        for o in parsed.ouros:
            if o.player_id is None:
                pid, name, _ = fuzzy_match_name(o.raw_name, all_candidates)
                o.player_id = pid
                o.player_name = name or o.raw_name

        if parsed.header.total_goals is not None and total_match_goals != parsed.header.total_goals:
            warnings.append(
                f"Soma de gols das partidas ({total_match_goals}) difere do cabeçalho ({parsed.header.total_goals})."
            )
        if parsed.header.total_assists is not None and total_match_assists != parsed.header.total_assists:
            warnings.append(
                f"Soma de assistências das partidas ({total_match_assists}) difere do cabeçalho ({parsed.header.total_assists})."
            )
        if not parsed.matches:
            warnings.append("Nenhuma partida foi extraída da tabela principal.")
        if not any(t.is_valid_team for t in parsed.teams):
            warnings.append("Nenhum time válido (>= 2 jogadores) foi extraído das tabelas inferiores.")

        parsed.warnings = warnings
        return parsed
