"""Application settings loaded from environment (.env)."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=True, alias="DEBUG")
    port: int = Field(default=8000, alias="PORT")

    google_cloud_project: str | None = Field(default=None, alias="GOOGLE_CLOUD_PROJECT")
    google_cloud_location: str = Field(default="us-central1", alias="GOOGLE_CLOUD_LOCATION")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")
    google_genai_use_vertexai: bool = Field(default=False, alias="GOOGLE_GENAI_USE_VERTEXAI")
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")

    firebase_project_id: str | None = Field(default=None, alias="FIREBASE_PROJECT_ID")
    use_firestore: bool = Field(default=False, alias="USE_FIRESTORE")
    google_application_credentials: str | None = Field(
        default=None,
        alias="GOOGLE_APPLICATION_CREDENTIALS",
        description="Absolute path to the Firebase / GCP service account JSON file.",
    )
    google_maps_api_key: str | None = Field(default=None, alias="GOOGLE_MAPS_API_KEY")

    # ReliefWeb API v2 requires a registered appname — https://apidoc.reliefweb.int/parameters#appname
    reliefweb_appname: str | None = Field(default=None, alias="RELIEFWEB_APPNAME")

    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def cors_origin_list(origins: str) -> list[str]:
    if origins.strip() == "*":
        return ["*"]
    return [o.strip() for o in origins.split(",") if o.strip()]
