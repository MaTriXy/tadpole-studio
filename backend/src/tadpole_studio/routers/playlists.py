import io
import uuid
import zipfile

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from tadpole_studio.config import settings
from tadpole_studio.db.connection import get_db
from tadpole_studio.models.common import (
    AddSongsRequest,
    PlaylistCreate,
    PlaylistDetailResponse,
    PlaylistResponse,
    PlaylistSongEntry,
    PlaylistUpdate,
    ReorderSongsRequest,
)
from tadpole_studio.routers.songs import _row_to_song

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("", response_model=list[PlaylistResponse])
async def list_playlists(
    search: str = Query(default="", description="Search in name and description"),
    sort: str = Query(default="created_at", description="Sort field"),
    order: str = Query(default="desc", description="Sort order: asc or desc"),
) -> list[PlaylistResponse]:
    db = await get_db()
    conditions: list[str] = []
    params: list = []

    if search:
        conditions.append("(p.name LIKE ? OR p.description LIKE ?)")
        like = f"%{search}%"
        params.extend([like, like])

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    order_dir = "ASC" if order.lower() == "asc" else "DESC"
    allowed_sorts = {"name", "created_at", "updated_at"}
    sort_field = sort if sort in allowed_sorts else "created_at"

    query = f"""
        SELECT p.*, COUNT(ps.id) AS song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        {where}
        GROUP BY p.id
        ORDER BY p.{sort_field} {order_dir}
    """

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [_row_to_playlist(row) for row in rows]


@router.post("", response_model=PlaylistResponse)
async def create_playlist(body: PlaylistCreate) -> PlaylistResponse:
    db = await get_db()
    playlist_id = str(uuid.uuid4())

    await db.execute(
        "INSERT INTO playlists (id, name, description, icon) VALUES (?, ?, ?, ?)",
        (playlist_id, body.name, body.description, body.icon),
    )
    await db.commit()

    cursor = await db.execute(
        """
        SELECT p.*, COUNT(ps.id) AS song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
        """,
        (playlist_id,),
    )
    row = await cursor.fetchone()
    return _row_to_playlist(row)


@router.get("/{playlist_id}", response_model=PlaylistDetailResponse)
async def get_playlist(playlist_id: str) -> PlaylistDetailResponse:
    return await _get_playlist_detail(playlist_id)


@router.patch("/{playlist_id}", response_model=PlaylistResponse)
async def update_playlist(
    playlist_id: str, body: PlaylistUpdate
) -> PlaylistResponse:
    db = await get_db()

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values())
    values.append(playlist_id)

    result = await db.execute(
        f"UPDATE playlists SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
        values,
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    await db.commit()

    cursor = await db.execute(
        """
        SELECT p.*, COUNT(ps.id) AS song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
        """,
        (playlist_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return _row_to_playlist(row)


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: str) -> dict:
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM playlists WHERE id = ?", (playlist_id,)
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    await db.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
    await db.commit()
    return {"deleted": True}


@router.post("/{playlist_id}/songs", response_model=PlaylistDetailResponse)
async def add_songs(
    playlist_id: str, body: AddSongsRequest
) -> PlaylistDetailResponse:
    db = await get_db()

    cursor = await db.execute(
        "SELECT id FROM playlists WHERE id = ?", (playlist_id,)
    )
    if await cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    cursor = await db.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_songs WHERE playlist_id = ?",
        (playlist_id,),
    )
    next_pos = (await cursor.fetchone())[0]

    await db.executemany(
        "INSERT OR IGNORE INTO playlist_songs (id, playlist_id, song_id, position) VALUES (?, ?, ?, ?)",
        [
            (str(uuid.uuid4()), playlist_id, song_id, next_pos + i)
            for i, song_id in enumerate(body.song_ids)
        ],
    )
    await db.commit()

    return await _get_playlist_detail(playlist_id)


@router.delete(
    "/{playlist_id}/songs/{song_id}", response_model=PlaylistDetailResponse
)
async def remove_song(
    playlist_id: str, song_id: str
) -> PlaylistDetailResponse:
    db = await get_db()

    await db.execute(
        "DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?",
        (playlist_id, song_id),
    )
    await db.commit()

    return await _get_playlist_detail(playlist_id)


@router.patch("/{playlist_id}/songs", response_model=PlaylistDetailResponse)
async def reorder_songs(
    playlist_id: str, body: ReorderSongsRequest
) -> PlaylistDetailResponse:
    db = await get_db()

    cursor = await db.execute(
        "SELECT song_id FROM playlist_songs WHERE playlist_id = ?",
        (playlist_id,),
    )
    rows = await cursor.fetchall()
    existing_ids = {row["song_id"] for row in rows}

    for sid in body.song_ids:
        if sid not in existing_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Song {sid} is not in this playlist",
            )

    await db.executemany(
        "UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?",
        [(position, playlist_id, sid) for position, sid in enumerate(body.song_ids)],
    )
    await db.commit()

    return await _get_playlist_detail(playlist_id)


@router.get("/{playlist_id}/export")
async def export_playlist(playlist_id: str):
    db = await get_db()

    cursor = await db.execute(
        "SELECT name FROM playlists WHERE id = ?", (playlist_id,)
    )
    playlist_row = await cursor.fetchone()
    if playlist_row is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    cursor = await db.execute(
        """
        SELECT s.title, s.file_path, s.file_format, ps.position
        FROM playlist_songs ps
        JOIN songs s ON s.id = ps.song_id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position ASC
        """,
        (playlist_id,),
    )
    rows = await cursor.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="Playlist has no songs")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for row in rows:
            audio_path = settings.AUDIO_DIR / row["file_path"]
            if not audio_path.exists():
                continue
            arcname = f"{row['position'] + 1:02d} - {row['title']}.{row['file_format']}"
            zf.write(str(audio_path), arcname)
    buf.seek(0)

    filename = f"{playlist_row['name']}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


async def _get_playlist_detail(playlist_id: str) -> PlaylistDetailResponse:
    db = await get_db()

    cursor = await db.execute(
        """
        SELECT p.*, COUNT(ps.id) AS song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
        """,
        (playlist_id,),
    )
    playlist_row = await cursor.fetchone()
    if playlist_row is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    cursor = await db.execute(
        """
        SELECT ps.id AS ps_id, ps.song_id, ps.position, ps.added_at, s.*
        FROM playlist_songs ps
        JOIN songs s ON s.id = ps.song_id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position ASC
        """,
        (playlist_id,),
    )
    song_rows = await cursor.fetchall()

    songs = [
        PlaylistSongEntry(
            id=row["ps_id"],
            song_id=row["song_id"],
            position=row["position"],
            added_at=row["added_at"] or "",
            song=_row_to_song(row),
        )
        for row in song_rows
    ]

    playlist = _row_to_playlist(playlist_row)
    return PlaylistDetailResponse(
        **playlist.model_dump(),
        songs=songs,
    )


def _row_to_playlist(row) -> PlaylistResponse:
    return PlaylistResponse(
        id=row["id"],
        name=row["name"],
        description=row["description"] or "",
        icon=row["icon"] or "ListMusic",
        cover_song_id=row["cover_song_id"],
        song_count=row["song_count"] if "song_count" in row.keys() else 0,
        created_at=row["created_at"] or "",
        updated_at=row["updated_at"] or "",
    )
