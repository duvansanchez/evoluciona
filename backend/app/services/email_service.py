"""
Servicio de email: genera HTML del informe semanal y lo envia via Gmail SMTP.
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
    if day["completed"]:
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
        </td>
      </tr>
      <tr><td style="padding:16px;background:#fafafa;">
    """

    if total == 0:
        html += '<p style="color:#9ca3af;margin:0;font-size:14px;">Sin respuestas esta semana.</p>'

    elif qtype in ("radio", "select", "checkbox"):
        for item in q.get("distribution", []):
            html += f"""
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:14px;color:#111827;">{item['label']}</span>
                <span style="font-size:13px;color:#6b7280;">{item['count']} &times; &nbsp;({item['pct']}%)</span>
              </div>
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

    html += "</td></tr></table>"
    return html


def build_html_report(data: Dict[str, Any]) -> str:
    """Genera el HTML completo del informe semanal."""

    # Cabecera de dias
    days_row = "".join(_day_badge(d) for d in data["day_records"])

    # Bloques de preguntas
    questions_html = "".join(_question_block(q) for q in data["questions"])

    # Color del % de completitud
    rate = data["completion_rate"]
    rate_color = "#16a34a" if rate >= 70 else "#d97706" if rate >= 40 else "#dc2626"

    html = f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Informe Semanal</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 32px 24px;">
          <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">
            Informe Semanal &bull; Daily Questions
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
            Semana del {data['week_start']} al {data['week_end']}.
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
