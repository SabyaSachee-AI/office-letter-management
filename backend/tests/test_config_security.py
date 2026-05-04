import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_rejects_default_jwt_secret():
    with pytest.raises(ValidationError):
        Settings(app_env="production", jwt_secret_key="change-me")


def test_development_allows_default_jwt_secret():
    s = Settings(app_env="development", jwt_secret_key="change-me")
    assert s.jwt_secret_key == "change-me"
