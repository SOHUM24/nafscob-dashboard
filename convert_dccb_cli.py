"""CLI: convert DCCB PDF(s) in a folder to Excel. Used by server.py."""
import sys
import re
from pathlib import Path

import pdfplumber
import pandas as pd


def detect_year(text):
    m = re.search(r"(\d{4})\s*[-–]\s*(\d{4})", text or "")
    return f"{m.group(1)}-{m.group(2)}" if m else "UNKNOWN"


def is_col_number_row(row):
    vals = [str(c or "").strip() for c in row if str(c or "").strip()]
    if not vals:
        return False
    return all(re.match(r"^\d+[\w\s()to+\-]*$", v) for v in vals)


def clean_state(raw):
    s = re.sub(r"^\d+\.\s*", "", str(raw or "")).replace("\n", " ")
    s = re.sub(r"[*:]+", "", s).strip()
    return re.sub(r"\s+", " ", s).upper()


def flatten_headers(header_rows, n_cols):
    matrix = []
    for hr in header_rows:
        row_h, last = [], ""
        for cell in hr:
            val = re.sub(r"\s+", " ", str(cell or "").replace("\n", " ")).strip()
            if val:
                last = val
            row_h.append(last)
        matrix.append(row_h)

    cols = []
    for ci in range(n_cols):
        parts, seen = [], set()
        for hrow in matrix:
            v = hrow[ci] if ci < len(hrow) else ""
            if v and v not in seen and "NAME OF THE" not in v:
                parts.append(v)
                seen.add(v)
        cols.append(" | ".join(parts) if parts else f"COL_{ci}")
    return cols


def parse_statewise_table(table, table_id):
    if not table or len(table) < 4:
        return []
    num_row_idx = next((i for i, row in enumerate(table) if is_col_number_row(row)), None)
    if num_row_idx is None:
        return []
    header_rows = table[:num_row_idx]
    data_rows = table[num_row_idx + 1 :]
    cols = flatten_headers(header_rows, len(table[0]))
    records = []
    for row in data_rows:
        if not row or not str(row[0] or "").strip():
            continue
        state = clean_state(row[0])
        if len(state) < 2:
            continue
        rec = {"State": state, "Table_ID": table_id}
        for ci in range(1, min(len(row), len(cols))):
            rec[cols[ci]] = row[ci]
        records.append(rec)
    return records


def parse_directory_page(table, text):
    if not table or len(table) < 3:
        return []
    state = clean_state(table[0][0] if table[0] else "")
    rec = {"State": state, "Table_ID": "DIRECTORY"}
    for row in table[1:]:
        if not row or len(row) < 2:
            continue
        indicator = re.sub(r"^\d+\.\s*", "", str(row[0] or "")).strip()
        if indicator and len(indicator) > 2:
            rec[indicator] = row[-1]
    return [rec] if len(rec) > 2 else []


def is_statewise_page(text):
    signals = ["ANDHRA PRADESH", "BIHAR", "GUJARAT", "MAHARASHTRA", "UTTAR PRADESH"]
    return (
        ("STATE WISE AND CONSOLIDATED" in text or "ALL INDIA POSITION" in text)
        and re.search(r"TABLE[-\s]+[IVXLC]+", text, re.I)
        and any(s in text for s in signals)
    )


def is_directory_page(text):
    return "Main Items" in text and any(
        k in text for k in ["WORKING CAPITAL", "TOTAL LOANS", "TOTAL DEPOSITS"]
    )


def convert_folder(pdf_folder, output_path):
    folder = Path(pdf_folder)
    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"No PDF files found in {pdf_folder}")

    all_records = []
    years = []
    with pdfplumber.open(pdfs[0]) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            yr = detect_year(text)
            if yr != "UNKNOWN":
                years.append(yr)
            tables = page.extract_tables() or []
            if not tables:
                continue
            table = tables[0]
            if is_statewise_page(text):
                m = re.search(
                    r"TABLE[-\s]*(X{0,3}(?:IX|IV|V?I{0,3})[A-Z]?(?:\s*\([A-Z]\))?)",
                    text,
                    re.I,
                )
                table_id = "TABLE-" + re.sub(r"\s+", "", m.group(1)).upper() if m else "TABLE-UNKNOWN"
                all_records.extend(parse_statewise_table(table, table_id))
            elif is_directory_page(text):
                all_records.extend(parse_directory_page(table, text))

    if not all_records:
        raise ValueError("No DCCB tables extracted from PDF")

    df = pd.DataFrame(all_records)
    year_label = years[0] if years else "UNKNOWN"
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="ALL_LONG_FORMAT", index=False)
        df.to_excel(writer, sheet_name="DCCB_Data", index=False)
    print(f"OK: {len(all_records)} rows, year={year_label}, output={output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_dccb_cli.py <pdf_folder> <output.xlsx>")
        sys.exit(1)
    convert_folder(sys.argv[1], sys.argv[2])
