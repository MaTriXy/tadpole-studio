import pytest


@pytest.mark.asyncio
async def test_generate_when_dit_not_loaded(client):
    resp = await client.post("/api/generate", json={
        "task_type": "text2music",
        "caption": "test song",
    })
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_get_nonexistent_job(client):
    resp = await client.get("/api/generate/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_format_when_lm_not_loaded(client):
    resp = await client.post("/api/format", json={
        "caption": "test caption",
    })
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_sample_when_lm_not_loaded(client):
    resp = await client.post("/api/sample", json={
        "query": "happy pop song",
    })
    assert resp.status_code == 503
