"""Exercise dotenv discovery without reading or modifying real credentials."""

import importlib.util
from pathlib import Path
import shutil

import pytest

from analyzer import config


@pytest.fixture
def isolated_config(tmp_path, monkeypatch):
    for name in ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_TIMEOUT_SECONDS"):
        monkeypatch.delenv(name, raising=False)
    module_dir = tmp_path / "ai-engine" / "analyzer"
    module_dir.mkdir(parents=True)
    source = module_dir / "config.py"
    shutil.copyfile(config.__file__, source)
    spec = importlib.util.spec_from_file_location("isolated_ai_settings", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, module_dir.parent


@pytest.mark.parametrize("working_dir", [".", "backend", "ai-engine"])
def test_discovers_module_dotenv_from_different_working_directories(
    working_dir, isolated_config, tmp_path, monkeypatch
):
    module, module_root = isolated_config
    (module_root / ".env").write_text(
        "GEMINI_API_KEY=fake-module-key\nGEMINI_MODEL=module-model\n", encoding="utf-8"
    )
    cwd = tmp_path / working_dir
    cwd.mkdir(exist_ok=True)
    monkeypatch.chdir(cwd)

    settings = module.get_settings()

    assert settings.GEMINI_API_KEY.get_secret_value() == "fake-module-key"
    assert settings.GEMINI_MODEL == "module-model"


def test_later_module_dotenv_overrides_cwd_file_and_environment_overrides_both(
    isolated_config, tmp_path, monkeypatch
):
    module, module_root = isolated_config
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text(
        "GEMINI_MODEL=cwd-model\nGEMINI_TIMEOUT_SECONDS=7\n", encoding="utf-8"
    )
    (module_root / ".env").write_text("GEMINI_MODEL=module-model\n", encoding="utf-8")
    settings = module.get_settings()
    assert settings.GEMINI_MODEL == "module-model"
    assert settings.GEMINI_TIMEOUT_SECONDS == 7.0

    monkeypatch.setenv("GEMINI_MODEL", "environment-model")
    assert module.get_settings().GEMINI_MODEL == "environment-model"


def test_cwd_dotenv_still_works_without_module_dotenv(isolated_config, tmp_path, monkeypatch):
    module, _ = isolated_config
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text("GEMINI_MODEL=cwd-model\n", encoding="utf-8")
    assert module.get_settings().GEMINI_MODEL == "cwd-model"


def test_missing_dotenv_and_key_allow_startup(isolated_config, tmp_path, monkeypatch):
    module, _ = isolated_config
    monkeypatch.chdir(tmp_path)
    settings = module.get_settings()
    assert settings.GEMINI_API_KEY is None
    assert settings.GEMINI_MODEL == "gemini-2.5-flash"


def test_discovery_paths_are_relative_cwd_then_absolute_module():
    env_files = config.AIEngineSettings.model_config["env_file"]
    assert env_files == (".env", str(Path(config.__file__).resolve().parent.parent / ".env"))
