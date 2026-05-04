from datetime import datetime, timezone
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _fmt_dt(dt: datetime | None) -> str:
    if dt is None:
        return ""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return dt.strftime("%Y-%m-%d %H:%M")


def build_letters_pdf(
    rows: list[dict[str, str]],
    *,
    title: str = "Letters export",
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        rightMargin=0.5 * inch,
        leftMargin=0.5 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.5 * inch,
    )
    styles = getSampleStyleSheet()
    story: list = [
        Paragraph(f"<b>{title}</b>", styles["Title"]),
        Spacer(1, 12),
    ]
    header = [
        "Serial",
        "Subject",
        "Status",
        "Priority",
        "Department",
        "Received from",
        "Created",
    ]
    table_data: list[list[str]] = [header]
    for r in rows:
        table_data.append(
            [
                r.get("serial_no", ""),
                r.get("subject", "")[:80],
                r.get("status", ""),
                r.get("priority", ""),
                r.get("department", ""),
                r.get("received_from", "")[:40],
                r.get("created_at", ""),
            ]
        )
    tbl = Table(table_data, repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ]
        )
    )
    story.append(tbl)
    doc.build(story)
    return buf.getvalue()


def build_letters_xlsx(
    rows: list[dict[str, str]],
    *,
    title: str = "Letters export",
) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Letters"
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    ws.append(
        [
            "Serial",
            "Subject",
            "Status",
            "Priority",
            "Department",
            "Received from",
            "Created",
        ]
    )
    header_row = ws.max_row
    for r in rows:
        ws.append(
            [
                r.get("serial_no", ""),
                r.get("subject", ""),
                r.get("status", ""),
                r.get("priority", ""),
                r.get("department", ""),
                r.get("received_from", ""),
                r.get("created_at", ""),
            ]
        )
    for cell in ws[header_row]:
        cell.font = Font(bold=True)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def letter_row_from_model(letter) -> dict[str, str]:
    dept_name = ""
    if letter.department is not None:
        dept_name = getattr(letter.department, "name", "") or ""
    return {
        "serial_no": letter.serial_no,
        "subject": letter.subject or "",
        "status": letter.status.value if hasattr(letter.status, "value") else str(letter.status),
        "priority": letter.priority.value if hasattr(letter.priority, "value") else str(letter.priority),
        "department": dept_name,
        "received_from": letter.received_from or "",
        "created_at": _fmt_dt(letter.created_at),
    }
