import pytest


@pytest.fixture(autouse=True)
def isolated_local_state(monkeypatch, tmp_path):
    monkeypatch.setenv("LAB_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LAB_CREDENTIALS_FILE", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("LAB_SESSION_TOKEN", "unit-test-session")
    monkeypatch.setenv("NOTION_API_KEY", "")
    monkeypatch.setenv("NOTION_ROOT_PAGE_IDS", "")
