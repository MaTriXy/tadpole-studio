import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "dit_model_loaded" in data
    assert "lm_model_loaded" in data


@pytest.mark.asyncio
async def test_health_degraded_when_models_not_loaded(client):
    resp = await client.get("/api/health")
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["dit_model_loaded"] is False


@pytest.mark.asyncio
async def test_settings_returns_200(client):
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "settings" in data
