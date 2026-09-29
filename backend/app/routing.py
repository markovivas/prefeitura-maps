import heapq
from typing import Any, Dict, List, Optional, Tuple


def compute_dijkstra_route(
    nodes: Dict[int, Dict[str, Any]],
    edges: List[Dict[str, Any]],
    start_node_id: int,
    end_node_id: int,
    accessible_only: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    Calcula a menor rota indoor usando o algoritmo de Dijkstra.
    Suporta múltiplos andares (via elevador ou escada) e filtro de acessibilidade.
    """
    if start_node_id not in nodes or end_node_id not in nodes:
        return None

    # Monta lista de adjacência
    adjacency: Dict[int, List[Dict[str, Any]]] = {nid: [] for nid in nodes}
    for edge in edges:
        if accessible_only and not edge.get("is_accessible", True):
            continue
        u = edge["from_node"]
        v = edge["to_node"]
        if u in adjacency and v in nodes:
            adjacency[u].append(edge)

    # Fila de prioridade de Dijkstra: (distância_acumulada, node_id)
    distances: Dict[int, float] = {nid: float("inf") for nid in nodes}
    previous_node: Dict[int, Optional[int]] = {nid: None for nid in nodes}
    previous_edge: Dict[int, Optional[Dict[str, Any]]] = {nid: None for nid in nodes}

    distances[start_node_id] = 0.0
    pq: List[Tuple[float, int]] = [(0.0, start_node_id)]
    visited = set()

    while pq:
        current_dist, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)

        if u == end_node_id:
            break

        for edge in adjacency.get(u, []):
            v = edge["to_node"]
            if v in visited:
                continue
            weight = float(edge["distance"])
            new_dist = current_dist + weight
            if new_dist < distances[v]:
                distances[v] = new_dist
                previous_node[v] = u
                previous_edge[v] = edge
                heapq.heappush(pq, (new_dist, v))

    if distances[end_node_id] == float("inf"):
        return None

    # Reconstrói o caminho de nós e arestas
    path_nodes: List[int] = []
    path_edges: List[Dict[str, Any]] = []
    curr: Optional[int] = end_node_id
    while curr is not None:
        path_nodes.append(curr)
        edge_used = previous_edge.get(curr)
        if edge_used is not None:
            path_edges.append(edge_used)
        curr = previous_node.get(curr)

    path_nodes.reverse()
    path_edges.reverse()

    # Gera instruções passo a passo consolidadas e claras
    raw_steps: List[Dict[str, Any]] = []
    for idx, edge in enumerate(path_edges):
        u_node = nodes[edge["from_node"]]
        v_node = nodes[edge["to_node"]]
        edge_type = edge.get("edge_type", "corridor")
        dist = round(float(edge["distance"]), 1)

        hint = edge.get("instruction_hint")
        if not hint:
            if edge_type == "elevator":
                hint = f"Utilize o elevador para ir ao {v_node['floor_name']}"
            elif edge_type == "stairs":
                hint = f"Utilize a escada para ir ao {v_node['floor_name']}"
            elif edge_type == "door":
                hint = f"Entre em {v_node['name']}"
            else:
                hint = f"Siga pelo corredor até {v_node['name']}"

        raw_steps.append(
            {
                "from_node_id": u_node["id"],
                "to_node_id": v_node["id"],
                "floor_id": v_node["floor_id"],
                "floor_name": v_node["floor_name"],
                "level": v_node["level"],
                "edge_type": edge_type,
                "distance": dist,
                "instruction": hint,
                "coordinates": v_node["coordinates"],
            }
        )

    # Consolida passos seguidos de corredor no mesmo andar para leitura fluida
    consolidated_steps: List[Dict[str, Any]] = []
    for step in raw_steps:
        if (
            consolidated_steps
            and consolidated_steps[-1]["edge_type"] == "corridor"
            and step["edge_type"] == "corridor"
            and consolidated_steps[-1]["floor_id"] == step["floor_id"]
            and "elevador" not in step["instruction"].lower()
            and "escada" not in step["instruction"].lower()
        ):
            consolidated_steps[-1]["distance"] = round(
                consolidated_steps[-1]["distance"] + step["distance"], 1
            )
            consolidated_steps[-1]["to_node_id"] = step["to_node_id"]
            consolidated_steps[-1]["coordinates"] = step["coordinates"]
        else:
            consolidated_steps.append(dict(step))

    for i, step in enumerate(consolidated_steps, start=1):
        step["step_number"] = i

    # Monta segmentos GeoJSON por pavimento para renderização no MapLibre
    features: List[Dict[str, Any]] = []
    current_segment_coords: List[List[float]] = []
    current_floor_id: Optional[int] = None
    current_level: Optional[int] = None
    current_floor_name: Optional[str] = None

    for nid in path_nodes:
        n = nodes[nid]
        if current_floor_id is None:
            current_floor_id = n["floor_id"]
            current_level = n["level"]
            current_floor_name = n["floor_name"]
            current_segment_coords = [n["coordinates"]]
        elif n["floor_id"] == current_floor_id:
            current_segment_coords.append(n["coordinates"])
        else:
            # Fecha segmento do pavimento anterior
            if len(current_segment_coords) >= 2:
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "feature_type": "route_segment",
                            "floor_id": current_floor_id,
                            "level": current_level,
                            "floor_name": current_floor_name,
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": current_segment_coords,
                        },
                    }
                )
            # Ponto de transição de andar
            prev_n = nodes[path_nodes[path_nodes.index(nid) - 1]]
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "feature_type": "floor_transition",
                        "from_floor_id": prev_n["floor_id"],
                        "from_level": prev_n["level"],
                        "to_floor_id": n["floor_id"],
                        "to_level": n["level"],
                        "to_floor_name": n["floor_name"],
                        "node_type": n["node_type"],
                        "label": f"Ir para {n['floor_name']}",
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": prev_n["coordinates"],
                    },
                }
            )
            current_floor_id = n["floor_id"]
            current_level = n["level"]
            current_floor_name = n["floor_name"]
            current_segment_coords = [n["coordinates"]]

    if len(current_segment_coords) >= 2:
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "feature_type": "route_segment",
                    "floor_id": current_floor_id,
                    "level": current_level,
                    "floor_name": current_floor_name,
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": current_segment_coords,
                },
            }
        )

    # Adiciona marcadores GeoJSON de Origem e Destino
    start_node = nodes[start_node_id]
    end_node = nodes[end_node_id]
    features.append(
        {
            "type": "Feature",
            "properties": {
                "feature_type": "route_endpoint",
                "endpoint_role": "origin",
                "floor_id": start_node["floor_id"],
                "level": start_node["level"],
                "name": start_node["name"],
            },
            "geometry": {
                "type": "Point",
                "coordinates": start_node["coordinates"],
            },
        }
    )
    features.append(
        {
            "type": "Feature",
            "properties": {
                "feature_type": "route_endpoint",
                "endpoint_role": "destination",
                "floor_id": end_node["floor_id"],
                "level": end_node["level"],
                "name": end_node["name"],
            },
            "geometry": {
                "type": "Point",
                "coordinates": end_node["coordinates"],
            },
        }
    )

    floors_traversed: List[Dict[str, Any]] = []
    seen_floors = set()
    for nid in path_nodes:
        n = nodes[nid]
        if n["floor_id"] not in seen_floors:
            seen_floors.add(n["floor_id"])
            floors_traversed.append(
                {
                    "floor_id": n["floor_id"],
                    "level": n["level"],
                    "name": n["floor_name"],
                }
            )

    total_distance = round(distances[end_node_id], 1)
    floor_changes = max(0, len(floors_traversed) - 1)
    estimated_seconds = int(round(total_distance / 1.2 + floor_changes * 15))

    return {
        "total_distance_meters": total_distance,
        "estimated_time_seconds": estimated_seconds,
        "accessible": accessible_only,
        "multi_floor": len(floors_traversed) > 1,
        "floors_traversed": floors_traversed,
        "origin": {
            "node_id": start_node["id"],
            "name": start_node["name"],
            "floor_id": start_node["floor_id"],
            "level": start_node["level"],
            "floor_name": start_node["floor_name"],
            "coordinates": start_node["coordinates"],
        },
        "destination": {
            "node_id": end_node["id"],
            "name": end_node["name"],
            "floor_id": end_node["floor_id"],
            "level": end_node["level"],
            "floor_name": end_node["floor_name"],
            "coordinates": end_node["coordinates"],
        },
        "steps": consolidated_steps,
        "path_nodes": [nodes[nid] for nid in path_nodes],
        "geojson": {
            "type": "FeatureCollection",
            "features": features,
        },
    }
