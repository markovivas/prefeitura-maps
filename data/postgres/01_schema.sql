-- ============================================================================
-- MVP Navegação Indoor da Prefeitura - Esquema PostGIS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Prédios Públicos (buildings)
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    footprint GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Andares / Pavimentos (floors)
CREATE TABLE IF NOT EXISTS floors (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER NOT NULL,
    outline GEOMETRY(Polygon, 4326),
    corridor_geometry GEOMETRY(Polygon, 4326),
    UNIQUE (building_id, level)
);

-- 3. Nós de Roteamento Indoor (routing_nodes)
CREATE TABLE IF NOT EXISTS routing_nodes (
    id SERIAL PRIMARY KEY,
    floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    node_type VARCHAR(50) NOT NULL DEFAULT 'corridor', -- entrance, corridor, room, elevator, stairs, restroom
    geometry GEOMETRY(Point, 4326) NOT NULL
);

-- 4. Salas e Setores de Atendimento (rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    department VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'service', -- reception, service, admin, vertical_circulation, facility
    description TEXT,
    opening_hours VARCHAR(100) DEFAULT '08:00 às 17:00',
    node_id INTEGER REFERENCES routing_nodes(id) ON DELETE SET NULL,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    UNIQUE (floor_id, code)
);

-- 5. Arestas do Grafo de Navegação (routing_edges)
CREATE TABLE IF NOT EXISTS routing_edges (
    id SERIAL PRIMARY KEY,
    from_node INTEGER NOT NULL REFERENCES routing_nodes(id) ON DELETE CASCADE,
    to_node INTEGER NOT NULL REFERENCES routing_nodes(id) ON DELETE CASCADE,
    distance DOUBLE PRECISION NOT NULL,
    edge_type VARCHAR(50) NOT NULL DEFAULT 'corridor', -- corridor, door, elevator, stairs
    is_accessible BOOLEAN NOT NULL DEFAULT TRUE,
    instruction_hint VARCHAR(255)
);

-- Índices Espaciais e de Busca
CREATE INDEX IF NOT EXISTS idx_buildings_footprint ON buildings USING GIST (footprint);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors (building_id, level);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms (floor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_geometry ON rooms USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_routing_nodes_floor ON routing_nodes (floor_id);
CREATE INDEX IF NOT EXISTS idx_routing_nodes_geometry ON routing_nodes USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_routing_edges_from ON routing_edges (from_node);
CREATE INDEX IF NOT EXISTS idx_routing_edges_to ON routing_edges (to_node);
