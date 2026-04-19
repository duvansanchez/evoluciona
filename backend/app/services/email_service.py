"""
Servicio de email: genera HTML del informe y lo envia via Gmail SMTP.
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Template HTML
# ---------------------------------------------------------------------------

def _bar(pct: int, color: str = "#4f46e5") -> str:
    """Genera una barra de progreso inline compatible con clientes de email."""
    filled = max(1, round(pct * 2.4))  # escala 0-100 a 0-240px
    return (
        f'<div style="background:#e5e7eb;border-radius:4px;height:14px;width:240px;overflow:hidden;">'
        f'<div style="background:{color};width:{filled}px;height:14px;border-radius:4px;"></div>'
        f'</div>'
    )


def _day_badge(day: Dict) -> str:
    DAYS = {"Mon": "Lun", "Tue": "Mar", "Wed": "Mie", "Thu": "Jue",
             "Fri": "Vie", "Sat": "Sab", "Sun": "Dom"}
    label = DAYS.get(day["weekday"], day["weekday"])
    skipped = day.get("skipped", 0) or 0
    answered = day.get("answered", 0) or 0
    if skipped > 0 and answered == 0:
        bg, color, symbol = "#fef3c7", "#92400e", "S"
    elif day["completed"]:
        bg, color, symbol = "#d1fae5", "#065f46", "&#10003;"
    else:
        bg, color, symbol = "#fee2e2", "#991b1b", "&#10007;"
    return (
        f'<td align="center" style="padding:4px;">'
        f'<div style="background:{bg};color:{color};border-radius:8px;'
        f'padding:8px 10px;font-weight:bold;font-size:13px;min-width:38px;">'
        f'{label}<br>{symbol}</div></td>'
    )


def _question_block(q: Dict) -> str:
    qtype = q["type"]
    total = q["total_responses"]
    feedback_count = q.get("feedback_count", 0)
    skip_count = q.get("skip_count", 0)
    header_color = {
        "radio": "#4f46e5", "select": "#0891b2",
        "checkbox": "#7c3aed", "text": "#d97706"
    }.get(qtype, "#6b7280")

    type_label = {"radio": "Opciones (radio)", "select": "Seleccion",
                  "checkbox": "Multiple", "text": "Texto libre"}.get(qtype, qtype)

    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;border-collapse:separate;">
      <tr>
        <td style="background:{header_color};padding:12px 16px;">
          <span style="color:white;font-weight:600;font-size:15px;">{q['text']}</span>
          <span style="color:rgba(255,255,255,0.75);font-size:12px;margin-left:10px;">{type_label} &bull; {total} respuesta{'s' if total != 1 else ''}</span>
          <span style="color:rgba(255,255,255,0.75);font-size:12px;margin-left:10px;">{feedback_count} feedback{'s' if feedback_count != 1 else ''}</span>
          <span style="color:rgba(255,255,255,0.75);font-size:12px;margin-left:10px;">{skip_count} salto{'s' if skip_count != 1 else ''}</span>
        </td>
      </tr>
      <tr><td style="padding:16px;background:#fafafa;">
    """

    if total == 0 and skip_count == 0:
        html += '<p style="color:#9ca3af;margin:0;font-size:14px;">Sin respuestas esta semana.</p>'
    elif total == 0 and skip_count > 0:
        html += f'<p style="color:#92400e;margin:0;font-size:14px;">No hubo respuestas, pero la pregunta fue saltada {skip_count} vez{"es" if skip_count != 1 else ""} en este periodo.</p>'

    elif qtype in ("radio", "select", "checkbox"):
        for item in q.get("distribution", []):
            html += f"""
            <div style="margin-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:7px;">
                <tr>
                  <td style="font-size:14px;color:#111827;font-weight:500;">{item['label']}</td>
                  <td align="right" style="white-space:nowrap;padding-left:16px;">
                    <span style="display:inline-block;background:#f3f4f6;color:#374151;font-size:13px;font-weight:700;padding:2px 10px;border-radius:20px;margin-right:6px;">{item['count']}x</span>
                    <span style="display:inline-block;background:{header_color};color:white;font-size:13px;font-weight:700;padding:2px 10px;border-radius:20px;">{item['pct']}%</span>
                  </td>
                </tr>
              </table>
              {_bar(item['pct'], header_color)}
            </div>
            """
    else:  # text
        for r in q.get("text_responses", []):
            from datetime import date
            try:
                d = date.fromisoformat(r["date"])
                DAYS_ES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
                day_label = DAYS_ES[d.weekday()]
            except Exception:
                day_label = r["date"]
            text = (r["response"] or "").replace("<", "&lt;").replace(">", "&gt;")
            html += f"""
            <div style="margin-bottom:10px;padding:10px 12px;background:white;
                        border-left:3px solid {header_color};border-radius:4px;">
              <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">{day_label}</div>
              <div style="font-size:14px;color:#374151;line-height:1.5;">{text}</div>
            </div>
            """

    if q.get("skips"):
        html += """
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
            Días saltados
          </div>
        """

        for item in q.get("skips", []):
            html += f"""
            <span style="display:inline-block;background:#fffbeb;color:#92400e;font-size:12px;
                         font-weight:600;padding:6px 10px;border-radius:999px;margin:0 8px 8px 0;border:1px solid #fcd34d;">
              {item['date']}
            </span>
            """

        html += "</div>"

    if q.get("feedbacks"):
        html += """
        <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
          <div style="font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
            Feedback del periodo
          </div>
        """

        for item in q.get("feedbacks", []):
            from datetime import date
            try:
                d = date.fromisoformat(item["date"])
                DAYS_ES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
                date_label = f"{DAYS_ES[d.weekday()]} {d.isoformat()}"
            except Exception:
                date_label = item["date"]
            feedback_text = (item["text"] or "").replace("<", "&lt;").replace(">", "&gt;")
            html += f"""
            <div style="margin-bottom:10px;padding:10px 12px;background:#fffbeb;
                        border-left:3px solid #f59e0b;border-radius:4px;">
              <div style="font-size:11px;color:#92400e;margin-bottom:4px;">{date_label}</div>
              <div style="font-size:14px;color:#374151;line-height:1.5;white-space:pre-wrap;">{feedback_text}</div>
            </div>
            """

        html += "</div>"

    html += "</td></tr></table>"
    return html


def _phrase_tag(text: str, tone: str = "primary") -> str:
    styles = {
        "primary": ("#eff6ff", "#1d4ed8", "#bfdbfe"),
        "success": ("#ecfdf5", "#047857", "#a7f3d0"),
        "warning": ("#fffbeb", "#b45309", "#fcd34d"),
        "muted": ("#f3f4f6", "#4b5563", "#d1d5db"),
    }
    bg, fg, border = styles.get(tone, styles["primary"])
    return (
        f'<span style="display:inline-block;background:{bg};color:{fg};font-size:12px;'
        f'font-weight:600;padding:6px 10px;border-radius:999px;margin:0 8px 8px 0;border:1px solid {border};">'
        f'{text}</span>'
    )


def build_html_phrase_report(data: Dict[str, Any]) -> str:
    """Genera el HTML del informe de frases para envio por Gmail."""
    top_phrases_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;font-weight:600;color:#111827;">{item['text']}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">{item.get('author') or 'Sin autor'}</div>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:700;color:#2563eb;">
            {item.get('count', 0)}x
          </td>
        </tr>
        """
        for item in data.get("top_phrases", [])[:10]
    ) or '<tr><td colspan="2" style="padding:10px 0;color:#6b7280;font-size:14px;">No hubo repasos en este periodo.</td></tr>'

    categories_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            {item.get('category_name') or 'Sin categoria'}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:700;color:#2563eb;">
            {item.get('count', 0)}
          </td>
        </tr>
        """
        for item in data.get("category_usage", [])[:8]
    ) or '<tr><td colspan="2" style="padding:10px 0;color:#6b7280;font-size:14px;">Sin categorias trabajadas.</td></tr>'

    plans_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            {item.get('name') or 'Sin plan'}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:700;color:#2563eb;">
            {item.get('count', 0)}
          </td>
        </tr>
        """
        for item in data.get("plans_used", [])[:8]
    ) or '<tr><td colspan="2" style="padding:10px 0;color:#6b7280;font-size:14px;">No hubo planes o modos registrados.</td></tr>'

    distribution_html = "".join(
        f"""
        <div style="margin-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
            <tr>
              <td style="font-size:13px;color:#6b7280;">{item['date']}</td>
              <td align="right" style="font-size:13px;font-weight:700;color:#111827;">{item['count']}</td>
            </tr>
          </table>
          {_bar(min(100, item['count'] * 10), "#2563eb")}
        </div>
        """
        for item in data.get("daily_distribution", [])
    ) or '<p style="color:#6b7280;font-size:14px;margin:0;">Sin distribucion disponible.</p>'

    report_title = "Informe de Frases"
    mode_label = "Semanal" if data.get("mode") == "weekly" else "Mensual"
    coverage = data.get("coverage", {})
    streaks = data.get("streaks", {})

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{report_title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0"
           style="max-width:640px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a,#2563eb);padding:32px 32px 24px;">
          <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">
            {report_title} &bull; {mode_label}
          </p>
          <h1 style="margin:8px 0 0;color:white;font-size:22px;font-weight:700;">{data.get('period_label')}</h1>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background:#eff6ff;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#2563eb;">{data.get('total_reviews', 0)}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Repasos del periodo</div>
              </td>
              <td width="12"></td>
              <td align="center" style="background:#ecfdf5;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#059669;">{data.get('days_with_review', 0)}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Dias con repaso</div>
              </td>
              <td width="12"></td>
              <td align="center" style="background:#fffbeb;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#d97706;">{coverage.get('percent', 0)}%</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Cobertura</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Rachas y cobertura
          </p>
          <div style="font-size:14px;color:#374151;line-height:1.7;">
            Racha actual: <strong>{streaks.get('current', 0)}</strong> dias<br>
            Racha maxima: <strong>{streaks.get('max', 0)}</strong> dias<br>
            Frases activas repasadas: <strong>{coverage.get('reviewed_active_phrases', 0)}</strong> de <strong>{coverage.get('active_phrases', 0)}</strong>
          </div>
        </td>
      </tr>

      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>

      <tr>
        <td style="padding:24px 32px 8px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Frases mas repasadas
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">{top_phrases_html}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 8px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Categorias mas trabajadas
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">{categories_html}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 8px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Planes de repaso usados
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">{plans_html}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Distribucion por dia
          </p>
          {distribution_html}
        </td>
      </tr>

      <tr>
        <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            Este informe fue generado automaticamente por Evoluciona.<br>
            Periodo: {data.get('period_start')} al {data.get('period_end')}.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def build_markdown_phrase_report(data: Dict[str, Any]) -> str:
    """Genera el informe de frases en Markdown para descarga local."""
    mode_label = "Semanal" if data.get("mode") == "weekly" else "Mensual"
    coverage = data.get("coverage", {})
    streaks = data.get("streaks", {})

    lines = [
        f"# Informe de Frases {mode_label}",
        "",
        f"## {data.get('period_label')}",
        "",
        f"- Periodo: {data.get('period_start')} a {data.get('period_end')}",
        f"- Total de repasos: {data.get('total_reviews', 0)}",
        f"- Dias con repaso: {data.get('days_with_review', 0)}",
        f"- Cobertura: {coverage.get('percent', 0)}% ({coverage.get('reviewed_active_phrases', 0)} de {coverage.get('active_phrases', 0)} frases activas)",
        f"- Racha actual: {streaks.get('current', 0)} dias",
        f"- Racha maxima: {streaks.get('max', 0)} dias",
        "",
        "## Frases mas repasadas",
        "",
    ]

    top_phrases = data.get("top_phrases", [])
    if top_phrases:
        for item in top_phrases:
            author = item.get("author") or "Sin autor"
            lines.append(f"- **{item.get('text', '')}**")
            lines.append(f"  - Autor: {author}")
            lines.append(f"  - Repasos: {item.get('count', 0)}")
    else:
        lines.append("- No hubo repasos en este periodo.")

    lines.extend(["", "## Categorias mas trabajadas", ""])
    category_usage = data.get("category_usage", [])
    if category_usage:
        for item in category_usage:
            lines.append(f"- {item.get('category_name') or 'Sin categoria'}: {item.get('count', 0)}")
    else:
        lines.append("- Sin categorias trabajadas.")

    lines.extend(["", "## Distribucion por dia", ""])
    daily_distribution = data.get("daily_distribution", [])
    if daily_distribution:
        for item in daily_distribution:
            lines.append(f"- {item.get('date')}: {item.get('count', 0)}")
    else:
        lines.append("- Sin distribucion disponible.")

    lines.extend(["", "## Planes de repaso usados", ""])
    plans_used = data.get("plans_used", [])
    if plans_used:
        for item in plans_used:
            lines.append(f"- {item.get('name') or 'Sin plan'}: {item.get('count', 0)}")
    else:
        lines.append("- No hubo planes o modos registrados.")

    return "\n".join(lines).strip() + "\n"


def build_html_rutina_report(data: Dict[str, Any]) -> str:
    """Genera el HTML del informe de rutinas para envio por Gmail o descarga."""
    top_routines_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-size:14px;font-weight:600;color:#111827;">{item.get('name')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">{item.get('day_part_label') or 'Sin parte del dia'}</div>
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">
            {item.get('completed', 0)}/{item.get('assigned', 0)}
          </td>
          <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:700;color:#2563eb;">
            {item.get('completion_rate', 0)}%
          </td>
        </tr>
        """
        for item in data.get("top_routines", [])
    ) or '<tr><td colspan="3" style="padding:10px 0;color:#6b7280;font-size:14px;">No hubo rutinas asignadas en este periodo.</td></tr>'

    day_parts_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            {item.get('label')}
          </td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">
            {item.get('completed', 0)}/{item.get('assigned', 0)}
          </td>
          <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:700;color:#2563eb;">
            {item.get('completion_rate', 0)}%
          </td>
        </tr>
        """
        for item in data.get("day_part_usage", [])
    ) or '<tr><td colspan="3" style="padding:10px 0;color:#6b7280;font-size:14px;">Sin actividad por parte del dia.</td></tr>'

    distribution_html = "".join(
        f"""
        <div style="margin-bottom:12px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
            <tr>
              <td style="font-size:13px;color:#6b7280;">{item['date']}</td>
              <td align="right" style="font-size:13px;color:#374151;">{item['completed']}/{item['assigned']}</td>
              <td align="right" style="width:70px;font-size:13px;font-weight:700;color:#111827;">{item['completion_rate']}%</td>
            </tr>
          </table>
          {_bar(item['completion_rate'], "#2563eb")}
        </div>
        """
        for item in data.get("daily_distribution", [])
        if item.get("assigned", 0) > 0
    ) or '<p style="color:#6b7280;font-size:14px;margin:0;">No hubo asignaciones en este periodo.</p>'

    coverage = data.get("coverage", {})
    streaks = data.get("streaks", {})
    goal_completion_summary = data.get("goal_completion_summary", {})
    routine_breakdown = data.get("routine_breakdown", [])
    routine_breakdown_html = "".join(
        f"""
        <div style="margin-bottom:18px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
            <tr>
              <td>
                <div style="font-size:15px;font-weight:700;color:#111827;">{routine.get('name')}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:4px;">{routine.get('day_part_label') or 'Sin parte del dia'} • Avance promedio: {routine.get('average_progress_percent', 0)}%</div>
              </td>
              <td align="right" style="font-size:12px;color:#6b7280;">
                {routine.get('linked_goals', 0)} tarea(s) vinculada(s)<br>
                {routine.get('failed_days', 0)} dia(s) incompleto(s) &nbsp;|&nbsp; {routine.get('neutral_days', 0)} neutral(es)
              </td>
            </tr>
          </table>
          {''.join(
            f'''
            <div style="margin-top:12px;padding:14px;border-radius:12px;border:1px solid {'#cbd5e1' if day.get('is_neutral') else '#bbf7d0' if day.get('progress_percent', 0) >= 100 else '#bfdbfe' if day.get('progress_percent', 0) >= 75 else '#fde68a' if day.get('progress_percent', 0) >= 25 else '#fecaca'};background:{'#f8fafc' if day.get('is_neutral') else '#f0fdf4' if day.get('progress_percent', 0) >= 100 else '#eff6ff' if day.get('progress_percent', 0) >= 75 else '#fffbeb' if day.get('progress_percent', 0) >= 25 else '#fef2f2'};">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td style="font-size:14px;font-weight:700;color:#111827;">{day.get('date')}</td>
                  <td align="right" style="font-size:12px;font-weight:700;color:{'#475569' if day.get('is_neutral') else '#166534' if day.get('progress_percent', 0) >= 100 else '#1d4ed8' if day.get('progress_percent', 0) >= 75 else '#92400e' if day.get('progress_percent', 0) >= 25 else '#b91c1c'};">
                    {'No computa' if day.get('is_neutral') else f"{day.get('progress_percent', 0)}%"} {day.get('progress_label', '')}
                  </td>
                </tr>
              </table>
              <div style="font-size:12px;color:#4b5563;line-height:1.7;margin-bottom:8px;">
                Tareas completadas: <strong>{day.get('completed_count', 0)} de {day.get('goal_count', 0)}</strong> &nbsp;|&nbsp;
                Saltadas: <strong>{day.get('skipped_count', 0)}</strong> &nbsp;|&nbsp;
                No completadas: <strong>{day.get('pending_count', 0)}</strong>
              </div>
              {''.join(
                f'''
                <div style="margin-top:6px;font-size:13px;line-height:1.6;color:#374151;">
                  <span style="display:inline-block;min-width:92px;font-weight:700;color:{'#166534' if goal.get('status') == 'completed' else '#92400e' if goal.get('status') == 'skipped' else '#b91c1c'};">
                    {'Completado' if goal.get('status') == 'completed' else 'Saltado' if goal.get('status') == 'skipped' else 'No completado'}:
                  </span>
                  <span>{((goal.get('icon') or '') + ' ' + (goal.get('title') or '')).strip()}</span>
                </div>
                '''
                for goal in day.get('goals', [])
              ) or '<p style="margin:0;font-size:13px;color:#6b7280;">Esta rutina no tiene objetivos vinculados.</p>'}
            </div>
            '''
            for day in routine.get('days', [])
          ) or '<p style="margin:0;font-size:13px;color:#6b7280;">No hubo dias asignados para esta rutina.</p>'}
        </div>
        """
        for routine in routine_breakdown
    ) or '<p style="color:#6b7280;font-size:14px;margin:0;">No hubo rutinas asignadas en este periodo.</p>'
    mode_label = "Semanal" if data.get("mode") == "weekly" else "Mensual"

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Informe de Rutinas</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0"
           style="max-width:640px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:linear-gradient(135deg,#0f172a,#0ea5e9);padding:32px 32px 24px;">
          <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">
            Informe de Rutinas &bull; {mode_label}
          </p>
          <h1 style="margin:8px 0 0;color:white;font-size:22px;font-weight:700;">{data.get('period_label')}</h1>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background:#eff6ff;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#2563eb;">{data.get('total_assignments', 0)}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Asignaciones</div>
              </td>
              <td width="12"></td>
              <td align="center" style="background:#ecfdf5;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#059669;">{data.get('completed_assignments', 0)}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Completadas</div>
              </td>
              <td width="12"></td>
              <td align="center" style="background:#fffbeb;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#d97706;">{data.get('completion_rate', 0)}%</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Cumplimiento</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Resumen del periodo
          </p>
          <div style="font-size:14px;color:#374151;line-height:1.7;">
            Dias con rutinas: <strong>{data.get('days_with_routines', 0)}</strong><br>
            Dias cumplidos por completo: <strong>{data.get('completed_days', 0)}</strong><br>
            Racha actual: <strong>{streaks.get('current', 0)}</strong> dias<br>
            Racha maxima: <strong>{streaks.get('max', 0)}</strong> dias<br>
            Rutinas activas usadas en el periodo: <strong>{coverage.get('percent', 0)}%</strong> ({coverage.get('assigned_active_routines', 0)} de {coverage.get('active_routines', 0)})
          </div>
        </td>
      </tr>

      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>

      <tr>
        <td style="padding:24px 32px 8px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Rutinas mas usadas
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">{top_routines_html}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 8px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Rendimiento por parte del dia
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">{day_parts_html}</table>
        </td>
      </tr>

      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Distribucion por dia
          </p>
          {distribution_html}
        </td>
      </tr>

      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Detalle completo por rutina y dia
          </p>
          <div style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px;">
            Completados registrados: <strong>{goal_completion_summary.get('total_completions', 0)}</strong><br>
            Dias con avances: <strong>{goal_completion_summary.get('days_with_completions', 0)}</strong><br>
            Agrupado por rutina, mostrando la lista de dias asignados y el estado de cada objetivo vinculado.
          </div>
          {routine_breakdown_html}
        </td>
      </tr>

      <tr>
        <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            Este informe fue generado automaticamente por Evoluciona.<br>
            Periodo: {data.get('period_start')} al {data.get('period_end')}.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def build_html_report(data: Dict[str, Any]) -> str:
    """Genera el HTML completo del informe."""

    is_monthly_report = data.get("report_title") == "Informe Mensual"

    # Cabecera de dias
    days_row = "".join(_day_badge(d) for d in data["day_records"])

    # Bloques de preguntas
    questions_html = "".join(_question_block(q) for q in data["questions"])
    skipped_days = data.get("skipped_days", [])
    skipped_days_html = ""

    if skipped_days:
        skipped_days_html = """
      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Preguntas saltadas por día
          </p>
"""
        for item in skipped_days:
            skipped_days_html += f"""
          <div style="margin-bottom:8px;font-size:14px;color:#374151;">
            <span style="display:inline-block;background:#fffbeb;color:#92400e;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;margin-right:10px;border:1px solid #fcd34d;">
              {item['date']}
            </span>
            {item['count']} pregunta{'s' if item['count'] != 1 else ''} saltada{'s' if item['count'] != 1 else ''}
          </div>
"""
        skipped_days_html += """
        </td>
      </tr>
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
"""

    # Color del % de completitud
    rate = data["completion_rate"]
    rate_color = "#16a34a" if rate >= 70 else "#d97706" if rate >= 40 else "#dc2626"

    report_title = data.get("report_title", "Informe")
    period_label = f"{data['week_start']} al {data['week_end']}"
    daily_register_section = ""

    if not is_monthly_report:
        daily_register_section = f"""
      <!-- Calendario semanal -->
      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Registro diario
          </p>
          <table cellpadding="0" cellspacing="0"><tr>{days_row}</tr></table>
        </td>
      </tr>

      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
"""

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{report_title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 32px 24px;">
          <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">
            {report_title} &bull; Daily Questions
          </p>
          <h1 style="margin:8px 0 0;color:white;font-size:22px;font-weight:700;">
            {data['week_label']}
          </h1>
        </td>
      </tr>

      <!-- Resumen -->
      <tr>
        <td style="padding:24px 32px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="background:#f0fdf4;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#16a34a;">{data['days_completed']}<span style="font-size:16px;color:#9ca3af;">/{data['days_total']}</span></div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Dias completados</div>
              </td>
              <td width="12"></td>
              <td align="center" style="background:#faf5ff;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:{rate_color};">{rate}%</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Completitud</div>
              </td>
              <td width="12"></td>
              <td align="center" style="background:#eff6ff;border-radius:10px;padding:16px 8px;">
                <div style="font-size:28px;font-weight:700;color:#2563eb;">{data['total_responses']}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px;">Respuestas totales</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      {daily_register_section}
      {skipped_days_html}

      <!-- Preguntas -->
      <tr>
        <td style="padding:24px 32px 8px;">
          <p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.5px;">
            Detalle por pregunta
          </p>
          {questions_html}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            Este informe fue generado automaticamente por Daily Questions.<br>
            Periodo: {period_label}.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body></html>"""

    return html


# ---------------------------------------------------------------------------
# Envio via Gmail SMTP
# ---------------------------------------------------------------------------

def send_weekly_report(html: str, subject: str) -> bool:
    """Envia el HTML por Gmail SMTP. Retorna True si fue exitoso."""
    gmail_user = settings.GMAIL_USER
    app_password = settings.GMAIL_APP_PASSWORD
    recipient = settings.REPORT_RECIPIENT or gmail_user

    if not gmail_user or not app_password:
        logger.error("GMAIL_USER o GMAIL_APP_PASSWORD no configurados en .env")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Daily Questions <{gmail_user}>"
    msg["To"] = recipient
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.login(gmail_user, app_password)
            server.sendmail(gmail_user, recipient, msg.as_string())
        logger.info(f"Informe semanal enviado a {recipient}")
        return True
    except Exception as e:
        logger.error(f"Error enviando email: {e}")
        return False
