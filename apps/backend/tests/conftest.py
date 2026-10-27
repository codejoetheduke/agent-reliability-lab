import pytest


@pytest.fixture(autouse=True)
def isolated_local_state(monkeypatch, tmp_path):
    monkeypatch.setenv("LAB_DATA_DIR", str(tmp_path))
