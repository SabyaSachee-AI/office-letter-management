from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Reads DATABASE_URL from .env; plain postgresql:// is normalized to postgresql+psycopg2://
    database_url: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/letter_management",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    app_env: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "app_env"),
    )
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_leeway_seconds: int = 30
    letter_upload_dir: str = "uploads/letters"
    solution_upload_dir: str = "uploads/solutions"
    max_letter_upload_bytes: int = 20 * 1024 * 1024
    max_solution_upload_bytes: int = 20 * 1024 * 1024
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins"),
    )
    log_level: str = Field(
        default="INFO",
        validation_alias=AliasChoices("LOG_LEVEL", "log_level"),
    )

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    @model_validator(mode="after")
    def reject_default_jwt_in_production(self) -> "Settings":
        env_lower = (self.app_env or "").lower()
        weak = {"change-me", "changeme", ""}
        if env_lower in ("production", "prod") and self.jwt_secret_key in weak:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a strong secret when APP_ENV is production"
            )
        return self


settings = Settings()
