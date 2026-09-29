import json
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_db_cursor
from app.schemas import (
    BuildingCreate,
    BuildingUpdate,
    FloorCreate,
    RoomCreate,
    RoomUpdate,
)

app = FastAPI(
    title="Prefeitura de Três Corações — Indoor Maps API",
    description="API de mapeamento indoor de prédios, andares, salas e setores de atendimento (PostGIS).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_json(val: Optional[str]) -> Optional[Dict[str, Any]]:
    if not val:
        return None
    return json.loads(val)


@app.on_event("startup")
def ensure_tres_coracoes_default():
    """Garante que o prédio principal padrão seja a Prefeitura Municipal de Três Corações - MG."""
    target_lat = -21.670830
    target_lon = -45.269030
    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute("SELECT id, name, latitude, longitude FROM buildings WHERE id = 1;")
            b = cur.fetchone()
            if b and abs(float(b["latitude"]) - (-23.550500)) < 0.01:
                dx = target_lon - float(b["longitude"])
                dy = target_lat - float(b["latitude"])
                cur.execute(
                    """
                    UPDATE buildings
                    SET name = %s,
                        address = %s,
                        description = %s,
                        latitude = %s,
                        longitude = %s,
                        footprint = ST_Translate(footprint, %s, %s)
                    WHERE id = 1;
                    """,
                    (
                        "Prefeitura Municipal de Três Corações",
                        "Av. Brasil, 225 - Jardim América, Três Corações - MG",
                        "Centro Administrativo Dr. Astolpho Gazzola — Sede administrativa e central de atendimento ao cidadão da Prefeitura Municipal de Três Corações.",
                        target_lat,
                        target_lon,
                        dx,
                        dy,
                    ),
                )
                cur.execute(
                    """
                    UPDATE floors
                    SET outline = ST_Translate(outline, %s, %s),
                        corridor_geometry = ST_Translate(corridor_geometry, %s, %s)
                    WHERE building_id = 1;
                    """,
                    (dx, dy, dx, dy),
                )
                cur.execute(
                    """
                    UPDATE rooms
                    SET geometry = ST_Translate(geometry, %s, %s)
                    WHERE floor_id IN (SELECT id FROM floors WHERE building_id = 1);
                    """,
                    (dx, dy),
                )
                cur.execute(
                    """
                    UPDATE routing_nodes
                    SET geometry = ST_Translate(geometry, %s, %s)
                    WHERE floor_id IN (SELECT id FROM floors WHERE building_id = 1);
                    """,
                    (dx, dy),
                )
    except Exception:
        pass


@app.get("/api/health", tags=["Sistema"])
def health_check():
    """Verifica a saúde da API e da extensão PostGIS."""
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT PostGIS_Full_Version() AS postgis_version;")
            row = cur.fetchone()
            return {
                "status": "ok",
                "database": "connected",
                "postgis": row["postgis_version"] if row else "unknown",
            }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao conectar ao PostGIS: {exc}")


# ============================================================================
# PRÉDIOS (BUILDINGS)
# ============================================================================

@app.get("/api/buildings", tags=["Prédios"])
def list_buildings():
    """Lista todos os prédios cadastrados com suas geometrias e andares."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                b.id,
                b.name,
                b.address,
                b.description,
                b.latitude,
                b.longitude,
                ST_AsGeoJSON(b.footprint) AS footprint_geojson
            FROM buildings b
            ORDER BY b.id;
            """
        )
        buildings = cur.fetchall()

        cur.execute(
            """
            SELECT id, building_id, name, level
            FROM floors
            ORDER BY building_id, level;
            """
        )
        all_floors = cur.fetchall()

    floors_by_building: Dict[int, List[Dict[str, Any]]] = {}
    for fl in all_floors:
        floors_by_building.setdefault(fl["building_id"], []).append(dict(fl))

    result = []
    for b in buildings:
        item = dict(b)
        item["footprint"] = _parse_json(item.pop("footprint_geojson", None))
        item["floors"] = floors_by_building.get(item["id"], [])
        result.append(item)
    return result


@app.get("/api/buildings/{building_id}", tags=["Prédios"])
def get_building(building_id: int):
    """Retorna os detalhes de um prédio específico e seus andares."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                id, name, address, description, latitude, longitude,
                ST_AsGeoJSON(footprint) AS footprint_geojson
            FROM buildings
            WHERE id = %s;
            """,
            (building_id,),
        )
        b = cur.fetchone()
        if not b:
            raise HTTPException(status_code=404, detail="Prédio não encontrado.")

        cur.execute(
            """
            SELECT id, building_id, name, level
            FROM floors
            WHERE building_id = %s
            ORDER BY level;
            """,
            (building_id,),
        )
        floors = [dict(f) for f in cur.fetchall()]

    item = dict(b)
    item["footprint"] = _parse_json(item.pop("footprint_geojson", None))
    item["floors"] = floors
    return item


@app.post("/api/buildings", tags=["Prédios"])
def create_building(payload: BuildingCreate):
    """Cria um novo prédio no banco PostGIS."""
    with get_db_cursor(commit=True) as cur:
        if payload.footprint_geojson:
            cur.execute(
                """
                INSERT INTO buildings (name, address, description, latitude, longitude, footprint)
                VALUES (%s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))
                RETURNING id;
                """,
                (
                    payload.name,
                    payload.address,
                    payload.description,
                    payload.latitude,
                    payload.longitude,
                    json.dumps(payload.footprint_geojson),
                ),
            )
        else:
            # Gera polígono padrão ao redor da coordenada informada
            lon, lat = payload.longitude, payload.latitude
            dx, dy = 0.00030, 0.00020
            wkt = f"POLYGON(({lon-dx} {lat-dy}, {lon+dx} {lat-dy}, {lon+dx} {lat+dy}, {lon-dx} {lat+dy}, {lon-dx} {lat-dy}))"
            cur.execute(
                """
                INSERT INTO buildings (name, address, description, latitude, longitude, footprint)
                VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
                RETURNING id;
                """,
                (payload.name, payload.address, payload.description, lat, lon, wkt),
            )
        new_id = cur.fetchone()["id"]
    return get_building(new_id)


@app.put("/api/buildings/{building_id}", tags=["Prédios"])
def update_building(building_id: int, payload: BuildingUpdate):
    """Atualiza dados cadastrais de um prédio e translada suas geometrias caso as coordenadas mudem."""
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, latitude, longitude FROM buildings WHERE id = %s;", (building_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Prédio não encontrado.")

        new_lat = payload.latitude if payload.latitude is not None else float(existing["latitude"])
        new_lon = payload.longitude if payload.longitude is not None else float(existing["longitude"])
        dx = new_lon - float(existing["longitude"])
        dy = new_lat - float(existing["latitude"])

        fields = []
        values = []
        for k, v in payload.model_dump(exclude_unset=True).items():
            if v is not None:
                fields.append(f"{k} = %s")
                values.append(v)

        if fields:
            values.append(building_id)
            cur.execute(
                f"UPDATE buildings SET {', '.join(fields)} WHERE id = %s;",
                tuple(values),
            )

        if abs(dx) > 1e-7 or abs(dy) > 1e-7:
            cur.execute(
                "UPDATE buildings SET footprint = ST_Translate(footprint, %s, %s) WHERE id = %s;",
                (dx, dy, building_id),
            )
            cur.execute(
                """
                UPDATE floors
                SET outline = ST_Translate(outline, %s, %s),
                    corridor_geometry = ST_Translate(corridor_geometry, %s, %s)
                WHERE building_id = %s;
                """,
                (dx, dy, dx, dy, building_id),
            )
            cur.execute(
                """
                UPDATE rooms
                SET geometry = ST_Translate(geometry, %s, %s)
                WHERE floor_id IN (SELECT id FROM floors WHERE building_id = %s);
                """,
                (dx, dy, building_id),
            )
            cur.execute(
                """
                UPDATE routing_nodes
                SET geometry = ST_Translate(geometry, %s, %s)
                WHERE floor_id IN (SELECT id FROM floors WHERE building_id = %s);
                """,
                (dx, dy, building_id),
            )
    return get_building(building_id)


# ============================================================================
# ANDARES (FLOORS) E CAMADAS GEOJSON
# ============================================================================

@app.get("/api/floors", tags=["Andares"])
def list_floors(building_id: Optional[int] = None):
    """Lista os andares cadastrados."""
    with get_db_cursor() as cur:
        if building_id is not None:
            cur.execute(
                """
                SELECT
                    f.id, f.building_id, f.name, f.level,
                    ST_AsGeoJSON(f.outline) AS outline_geojson,
                    ST_AsGeoJSON(f.corridor_geometry) AS corridor_geojson,
                    (SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.id) AS rooms_count
                FROM floors f
                WHERE f.building_id = %s
                ORDER BY f.level;
                """,
                (building_id,),
            )
        else:
            cur.execute(
                """
                SELECT
                    f.id, f.building_id, f.name, f.level,
                    ST_AsGeoJSON(f.outline) AS outline_geojson,
                    ST_AsGeoJSON(f.corridor_geometry) AS corridor_geojson,
                    (SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.id) AS rooms_count
                FROM floors f
                ORDER BY f.building_id, f.level;
                """
            )
        rows = cur.fetchall()

    result = []
    for row in rows:
        item = dict(row)
        item["outline"] = _parse_json(item.pop("outline_geojson", None))
        item["corridor_geometry"] = _parse_json(item.pop("corridor_geojson", None))
        result.append(item)
    return result


@app.post("/api/floors", tags=["Andares"])
def create_floor(payload: FloorCreate):
    """Cadastra um novo pavimento copiando o contorno padrão do prédio."""
    with get_db_cursor(commit=True) as cur:
        cur.execute(
            """
            INSERT INTO floors (building_id, name, level, outline, corridor_geometry)
            SELECT
                %s, %s, %s,
                footprint,
                ST_GeomFromText('POLYGON((-45.26910 -21.67095, -45.26896 -21.67095, -45.26896 -21.67072, -45.26910 -21.67072, -45.26910 -21.67095))', 4326)
            FROM buildings
            WHERE id = %s
            ON CONFLICT (building_id, level) DO UPDATE
            SET name = EXCLUDED.name
            RETURNING id, building_id, name, level;
            """,
            (payload.building_id, payload.name, payload.level, payload.building_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Prédio informado não existe.")
        return dict(row)


@app.delete("/api/floors/{floor_id}", tags=["Andares"])
def delete_floor(floor_id: int):
    """Remove um andar pelo ID."""
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM floors WHERE id = %s RETURNING id;", (floor_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Andar não encontrado.")
    return {"deleted": True, "id": floor_id}


@app.get("/api/floors/{floor_id}/geojson", tags=["Andares"])
def get_floor_geojson(floor_id: int):
    """
    Retorna um FeatureCollection GeoJSON completo de um andar para o MapLibre GL JS:
    - contorno do pavimento (outline)
    - corredor de circulação (corridor)
    - salas e setores (rooms + centroide para rótulo)
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                id, building_id, name, level,
                ST_AsGeoJSON(outline) AS outline_geojson,
                ST_AsGeoJSON(corridor_geometry) AS corridor_geojson
            FROM floors
            WHERE id = %s;
            """,
            (floor_id,),
        )
        floor = cur.fetchone()
        if not floor:
            raise HTTPException(status_code=404, detail="Andar não encontrado.")

        # Salas do andar
        cur.execute(
            """
            SELECT
                r.id, r.floor_id, r.code, r.name, r.department, r.category,
                r.description, r.opening_hours,
                ST_AsGeoJSON(r.geometry) AS geom_geojson,
                ST_AsGeoJSON(ST_Centroid(r.geometry)) AS centroid_geojson
            FROM rooms r
            WHERE r.floor_id = %s
            ORDER BY r.code;
            """,
            (floor_id,),
        )
        rooms = cur.fetchall()

    features: List[Dict[str, Any]] = []

    if floor["outline_geojson"]:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "layer_type": "floor_outline",
                    "floor_id": floor["id"],
                    "level": floor["level"],
                    "name": floor["name"],
                },
                "geometry": _parse_json(floor["outline_geojson"]),
            }
        )

    if floor["corridor_geojson"]:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "layer_type": "corridor",
                    "floor_id": floor["id"],
                    "level": floor["level"],
                    "name": f"Corredor - {floor['name']}",
                },
                "geometry": _parse_json(floor["corridor_geojson"]),
            }
        )

    for r in rooms:
        geom = _parse_json(r["geom_geojson"])
        centroid = _parse_json(r["centroid_geojson"])
        props = {
            "layer_type": "room",
            "id": r["id"],
            "floor_id": r["floor_id"],
            "level": floor["level"],
            "floor_name": floor["name"],
            "code": r["code"],
            "name": r["name"],
            "department": r["department"],
            "category": r["category"],
            "description": r["description"] or "",
            "opening_hours": r["opening_hours"] or "08:00 às 17:00",
            "label": f"{r['name']}\n{r['department']}",
        }
        features.append({"type": "Feature", "id": r["id"], "properties": props, "geometry": geom})
        if centroid:
            label_props = dict(props)
            label_props["layer_type"] = "room_label"
            features.append({"type": "Feature", "properties": label_props, "geometry": centroid})

    return {
        "type": "FeatureCollection",
        "floor": {
            "id": floor["id"],
            "building_id": floor["building_id"],
            "name": floor["name"],
            "level": floor["level"],
        },
        "features": features,
    }


# ============================================================================
# SALAS E BUSCA (ROOMS)
# ============================================================================

@app.get("/api/rooms", tags=["Salas"])
def list_rooms(
    building_id: Optional[int] = None,
    floor_id: Optional[int] = None,
    level: Optional[int] = None,
    q: Optional[str] = Query(None, description="Busca por código, nome, secretaria ou serviço"),
):
    """Lista e pesquisa salas por pavimento, prédio ou termo de busca."""
    conditions = []
    params: List[Any] = []

    if building_id is not None:
        conditions.append("f.building_id = %s")
        params.append(building_id)
    if floor_id is not None:
        conditions.append("r.floor_id = %s")
        params.append(floor_id)
    if level is not None:
        conditions.append("f.level = %s")
        params.append(level)
    if isinstance(q, str) and q.strip():
        search_term = f"%{q.strip()}%"
        conditions.append(
            "(r.code ILIKE %s OR r.name ILIKE %s OR r.department ILIKE %s OR COALESCE(r.description, '') ILIKE %s)"
        )
        params.extend([search_term, search_term, search_term, search_term])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_db_cursor() as cur:
        cur.execute(
            f"""
            SELECT
                r.id, r.floor_id, f.level, f.name AS floor_name, f.building_id,
                r.code, r.name, r.department, r.category, r.description,
                r.opening_hours,
                ST_AsGeoJSON(r.geometry) AS geom_geojson,
                ST_X(ST_Centroid(r.geometry)) AS longitude,
                ST_Y(ST_Centroid(r.geometry)) AS latitude
            FROM rooms r
            JOIN floors f ON f.id = r.floor_id
            {where_clause}
            ORDER BY f.level, r.code;
            """,
            tuple(params),
        )
        rows = cur.fetchall()

    result = []
    for row in rows:
        item = dict(row)
        item["geometry"] = _parse_json(item.pop("geom_geojson", None))
        result.append(item)
    return result


@app.post("/api/rooms", tags=["Salas"])
def create_room(payload: RoomCreate):
    """Cadastra ou atualiza uma sala ou setor no andar especificado (com polígono desenhado no mapa)."""
    with get_db_cursor(commit=True) as cur:
        if payload.geometry:
            geom_sql = (
                "COALESCE("
                "ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)), 3), 1), "
                "ST_ConvexHull(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))"
                ")"
            )
            geom_json = json.dumps(payload.geometry)
            geom_params = (geom_json, geom_json)
        else:
            # Polígono padrão caso não seja enviado um GeoJSON customizado
            geom_sql = "ST_GeomFromText(%s, 4326)"
            geom_params = (
                "POLYGON((-45.26928 -21.67101, -45.26918 -21.67101, -45.26918 -21.67095, -45.26928 -21.67095, -45.26928 -21.67101))",
            )

        cur.execute(
            f"""
            INSERT INTO rooms (floor_id, code, name, department, category, description, opening_hours, geometry)
            VALUES (%s, %s, %s, %s, %s, %s, %s, {geom_sql})
            ON CONFLICT (floor_id, code) DO UPDATE
            SET name = EXCLUDED.name,
                department = EXCLUDED.department,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                opening_hours = EXCLUDED.opening_hours,
                geometry = EXCLUDED.geometry
            RETURNING id;
            """,
            (
                payload.floor_id,
                payload.code.strip(),
                payload.name.strip(),
                payload.department.strip(),
                payload.category,
                payload.description,
                payload.opening_hours,
                *geom_params,
            ),
        )
        new_id = cur.fetchone()["id"]

    rooms = list_rooms()
    for r in rooms:
        if r["id"] == new_id:
            return r
    return {"id": new_id}


@app.put("/api/rooms/{room_id}", tags=["Salas"])
def update_room(room_id: int, payload: RoomUpdate):
    """Atualiza os dados e/ou a geometria desenhada de uma sala existente."""
    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, floor_id, code FROM rooms WHERE id = %s;", (room_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Sala não encontrada.")

        data = payload.model_dump(exclude_unset=True)
        geometry_obj = data.pop("geometry", None)

        target_floor_id = data.get("floor_id", existing["floor_id"])
        target_code = (data.get("code") or existing["code"]).strip()
        if "code" in data and data["code"] is not None:
            data["code"] = target_code

        # Se já existir outra sala no mesmo andar com o mesmo código, remove a antiga para permitir salvar sem erro
        cur.execute(
            "DELETE FROM rooms WHERE floor_id = %s AND code = %s AND id <> %s;",
            (target_floor_id, target_code, room_id),
        )

        fields = []
        values = []
        for k, v in data.items():
            if v is not None:
                fields.append(f"{k} = %s")
                values.append(v)

        if geometry_obj is not None:
            fields.append(
                "geometry = COALESCE("
                "ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)), 3), 1), "
                "ST_ConvexHull(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))"
                ")"
            )
            geom_json = json.dumps(geometry_obj)
            values.extend([geom_json, geom_json])

        if fields:
            values.append(room_id)
            cur.execute(
                f"UPDATE rooms SET {', '.join(fields)} WHERE id = %s;",
                tuple(values),
            )

    rooms = list_rooms()
    for r in rooms:
        if r["id"] == room_id:
            return r
    return {"id": room_id}


@app.delete("/api/rooms/{room_id}", tags=["Salas"])
def delete_room(room_id: int):
    """Remove uma sala pelo ID."""
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM rooms WHERE id = %s RETURNING id;", (room_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Sala não encontrada.")
    return {"deleted": True, "id": room_id}


# ============================================================================
# ESTATÍSTICAS DO PAINEL ADMINISTRATIVO (/api/admin/stats)
# ============================================================================

@app.get("/api/admin/stats", tags=["Admin"])
def get_admin_stats():
    """Retorna indicadores gerais para o painel administrativo /admin."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM buildings) AS buildings_count,
                (SELECT COUNT(*) FROM floors) AS floors_count,
                (SELECT COUNT(*) FROM rooms) AS rooms_count;
            """
        )
        return dict(cur.fetchone())
