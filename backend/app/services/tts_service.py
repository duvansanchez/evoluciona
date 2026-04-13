"""
Servicio TTS con soporte para Edge TTS, ElevenLabs y fallback al navegador.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

from app.config import settings
from app.models.models import PhraseAudioPreference

logger = logging.getLogger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

try:
    import edge_tts  # type: ignore
except Exception:  # pragma: no cover - depende de la dependencia instalada
    edge_tts = None


class TTSServiceError(Exception):
    """Error controlado al generar audio."""


def _normalize_rate(value: Optional[float]) -> float:
    if value is None:
        return 1.0
    return max(0.5, min(1.5, float(value)))


def _normalize_pitch(value: Optional[float]) -> float:
    if value is None:
        return 1.0
    return max(0.5, min(1.5, float(value)))


def _normalize_pause_ms(value: Optional[int]) -> int:
    if value is None:
        return 700
    return max(300, min(5000, int(value)))


def _edge_rate(rate: float) -> str:
    pct = round((rate - 1.0) * 100)
    return f"{pct:+d}%"


def _edge_pitch(pitch: float) -> str:
    hz = round((pitch - 1.0) * 50)
    return f"{hz:+d}Hz"


def get_audio_preferences(db) -> PhraseAudioPreference:
    prefs = db.query(PhraseAudioPreference).order_by(PhraseAudioPreference.id.asc()).first()
    if prefs:
        prefs.rate = _normalize_rate(prefs.rate)
        prefs.pitch = _normalize_pitch(prefs.pitch)
        prefs.pause_ms = _normalize_pause_ms(prefs.pause_ms)
        return prefs

    prefs = PhraseAudioPreference(
        selected_voice_name=None,
        rate=1.0,
        pitch=1.0,
        pause_ms=700,
    )
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs


def update_audio_preferences(
    db,
    *,
    selected_voice_name: Optional[str] = None,
    rate: Optional[float] = None,
    pitch: Optional[float] = None,
    pause_ms: Optional[int] = None,
) -> PhraseAudioPreference:
    prefs = get_audio_preferences(db)

    if selected_voice_name is not None:
        prefs.selected_voice_name = selected_voice_name or None
    if rate is not None:
        prefs.rate = _normalize_rate(rate)
    if pitch is not None:
        prefs.pitch = _normalize_pitch(pitch)
    if pause_ms is not None:
        prefs.pause_ms = _normalize_pause_ms(pause_ms)

    db.commit()
    db.refresh(prefs)
    return prefs


def _preferred_provider() -> str:
    provider = (settings.TTS_PROVIDER or "auto").strip().lower()
    if provider in {"edge", "elevenlabs", "browser", "auto"}:
        return provider
    return "auto"


def is_elevenlabs_configured() -> bool:
    return bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_VOICE_ID)


def is_edge_tts_available() -> bool:
    return edge_tts is not None


def _headers() -> Dict[str, str]:
    return {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }


def _resolve_active_provider() -> str:
    configured = _preferred_provider()

    if configured == "browser":
        return "browser"

    if configured == "edge":
        return "edge" if is_edge_tts_available() else "browser"

    if configured == "elevenlabs":
        return "elevenlabs" if is_elevenlabs_configured() else "browser"

    if is_edge_tts_available():
        return "edge"

    if is_elevenlabs_configured():
        return "elevenlabs"

    return "browser"


def get_tts_status() -> Dict[str, Any]:
    """Retorna el proveedor TTS activo segun la configuracion disponible."""
    provider = _resolve_active_provider()

    if provider == "edge":
        return {
            "enabled": True,
            "provider": "edge",
            "voice_id": settings.EDGE_TTS_VOICE,
            "voice_name": settings.EDGE_TTS_VOICE,
            "model_id": None,
        }

    if provider == "elevenlabs":
        voice_name: Optional[str] = None
        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.get(
                    f"{ELEVENLABS_BASE_URL}/voices/{settings.ELEVENLABS_VOICE_ID}",
                    headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
                )
                if response.is_success:
                    payload = response.json()
                    voice_name = payload.get("name")
        except Exception as exc:
            logger.warning("No se pudo consultar la voz configurada en ElevenLabs: %s", exc)

        return {
            "enabled": True,
            "provider": "elevenlabs",
            "voice_id": settings.ELEVENLABS_VOICE_ID,
            "voice_name": voice_name,
            "model_id": settings.ELEVENLABS_MODEL_ID,
        }

    return {
        "enabled": False,
        "provider": "browser",
        "voice_id": None,
        "voice_name": None,
        "model_id": None,
    }


async def _synthesize_with_edge_async(text: str, rate: float, pitch: float) -> bytes:
    communicate = edge_tts.Communicate(
        text=text,
        voice=settings.EDGE_TTS_VOICE,
        rate=_edge_rate(rate),
        pitch=_edge_pitch(pitch),
    )
    audio_chunks: list[bytes] = []

    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio_chunks.append(chunk["data"])

    if not audio_chunks:
        raise TTSServiceError("Edge TTS no devolvio audio")

    return b"".join(audio_chunks)


def _synthesize_with_edge(text: str, rate: float, pitch: float) -> bytes:
    if not is_edge_tts_available():
        raise TTSServiceError("Edge TTS no esta disponible en el backend")

    try:
        return asyncio.run(_synthesize_with_edge_async(text, rate, pitch))
    except RuntimeError:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_synthesize_with_edge_async(text, rate, pitch))
        finally:
            loop.close()
    except Exception as exc:
        raise TTSServiceError(f"Error Edge TTS: {exc}") from exc


def _synthesize_with_elevenlabs(text: str, rate: float, pitch: float) -> bytes:
    if not is_elevenlabs_configured():
        raise TTSServiceError("ElevenLabs no esta configurado")

    payload = {
        "text": text,
        "model_id": settings.ELEVENLABS_MODEL_ID,
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.75,
        },
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{ELEVENLABS_BASE_URL}/text-to-speech/{settings.ELEVENLABS_VOICE_ID}",
                headers=_headers(),
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise TTSServiceError(f"Error de red con ElevenLabs: {exc}") from exc

    if not response.is_success:
        detail = response.text[:500]
        raise TTSServiceError(f"Error ElevenLabs {response.status_code}: {detail}")

    return response.content


def synthesize_text(text: str, rate: Optional[float] = None, pitch: Optional[float] = None) -> bytes:
    """Genera audio con el proveedor activo configurado."""
    clean_text = (text or "").strip()
    if not clean_text:
        raise TTSServiceError("No hay texto para sintetizar")

    normalized_rate = _normalize_rate(rate)
    normalized_pitch = _normalize_pitch(pitch)
    provider = _resolve_active_provider()

    if provider == "edge":
        return _synthesize_with_edge(clean_text, normalized_rate, normalized_pitch)

    if provider == "elevenlabs":
        return _synthesize_with_elevenlabs(clean_text, normalized_rate, normalized_pitch)

    raise TTSServiceError("No hay proveedor TTS configurado; usa el navegador como fallback")
