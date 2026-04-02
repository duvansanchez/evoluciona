"""
Servicio para integrar ElevenLabs Text-to-Speech.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


class ElevenLabsServiceError(Exception):
    """Error controlado al comunicarse con ElevenLabs."""


def is_elevenlabs_configured() -> bool:
    return bool(settings.ELEVENLABS_API_KEY and settings.ELEVENLABS_VOICE_ID)


def _headers() -> Dict[str, str]:
    return {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }


def get_tts_status() -> Dict[str, Any]:
    """Retorna si ElevenLabs esta configurado y la voz actual cuando sea posible."""
    if not is_elevenlabs_configured():
        return {
            "enabled": False,
            "provider": "browser",
            "voice_id": None,
            "voice_name": None,
            "model_id": None,
        }

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


def synthesize_text(text: str) -> bytes:
    """Genera audio MP3 usando la voz configurada en ElevenLabs."""
    if not is_elevenlabs_configured():
        raise ElevenLabsServiceError("ElevenLabs no esta configurado")

    clean_text = (text or "").strip()
    if not clean_text:
        raise ElevenLabsServiceError("No hay texto para sintetizar")

    payload = {
        "text": clean_text,
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
        raise ElevenLabsServiceError(f"Error de red con ElevenLabs: {exc}") from exc

    if not response.is_success:
        detail = response.text[:500]
        raise ElevenLabsServiceError(f"Error ElevenLabs {response.status_code}: {detail}")

    return response.content
