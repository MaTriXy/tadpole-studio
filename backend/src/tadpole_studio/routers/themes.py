import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from tadpole_studio.db.connection import get_db
from tadpole_studio.models.common import CustomThemeCreate, CustomThemeResponse

router = APIRouter(prefix="/themes", tags=["themes"])


@router.get("", response_model=list[CustomThemeResponse])
async def list_themes() -> list[CustomThemeResponse]:
    db = await get_db()
    cursor = await db.execute(
        "SELECT id, name, css, color_scheme, preview_bg, preview_sidebar, preview_primary, created_at FROM custom_themes ORDER BY created_at"
    )
    rows = await cursor.fetchall()
    return [
        CustomThemeResponse(
            id=row["id"],
            name=row["name"],
            css=row["css"],
            color_scheme=row["color_scheme"],
            preview_bg=row["preview_bg"],
            preview_sidebar=row["preview_sidebar"],
            preview_primary=row["preview_primary"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


@router.post("", response_model=CustomThemeResponse, status_code=201)
async def create_theme(body: CustomThemeCreate) -> CustomThemeResponse:
    db = await get_db()
    theme_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        """INSERT INTO custom_themes (id, name, css, color_scheme, preview_bg, preview_sidebar, preview_primary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (theme_id, body.name, body.css, body.color_scheme, body.preview_bg, body.preview_sidebar, body.preview_primary, now),
    )
    await db.commit()
    return CustomThemeResponse(
        id=theme_id,
        name=body.name,
        css=body.css,
        color_scheme=body.color_scheme,
        preview_bg=body.preview_bg,
        preview_sidebar=body.preview_sidebar,
        preview_primary=body.preview_primary,
        created_at=now,
    )


@router.delete("/{theme_id}")
async def delete_theme(theme_id: str):
    db = await get_db()
    cursor = await db.execute("DELETE FROM custom_themes WHERE id = ?", (theme_id,))
    await db.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Theme not found")
    return {"deleted": True}
