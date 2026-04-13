"""
Configuración centralizada de la aplicación.
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    """Variables de configuración desde .env o variables de entorno."""
    
    # Servidor
    API_TITLE: str = "Daily Questions API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Base de datos SQL Server
    DB_SERVER: str = "localhost"
    DB_NAME: str = "DailyQuestions"
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"

    # Email (Gmail SMTP)
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""
    REPORT_RECIPIENT: str = ""  # Puede ser el mismo GMAIL_USER

    # ElevenLabs TTS
    TTS_PROVIDER: str = "edge"
    EDGE_TTS_VOICE: str = "es-CO-GonzaloNeural"
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = ""
    ELEVENLABS_MODEL_ID: str = "eleven_multilingual_v2"

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_value(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on", "debug"}:
                return True
            if normalized in {"false", "0", "no", "off", "release", "prod", "production"}:
                return False
        return value
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def DATABASE_URL(self) -> str:
        """Construye la URL de conexión a SQL Server."""
        if self.DB_USER and self.DB_PASSWORD:
            return (
                f"mssql+pyodbc://{self.DB_USER}:{self.DB_PASSWORD}@"
                f"{self.DB_SERVER}/{self.DB_NAME}?"
                f"driver={self.DB_DRIVER.replace(' ', '+')}&"
                f"charset=utf8"
            )
        else:
            # Conexión con Windows Authentication
            return (
                f"mssql+pyodbc:///?driver={self.DB_DRIVER.replace(' ', '+')}&"
                f"server={self.DB_SERVER}&database={self.DB_NAME}&"
                f"Trusted_Connection=yes&charset=utf8"
            )


settings = Settings()
