/**
 * Cliente HTTP para a API FastAPI de Navegação Indoor da Prefeitura.
 */
const API_BASE = window.location.port === "8000" ? "/api" : "/api";

async function requestJSON(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errDetail = `Erro HTTP ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) errDetail = errData.detail;
    } catch (_) {}
    throw new Error(errDetail);
  }
  return response.json();
}

export const IndoorAPI = {
  getHealth: () => requestJSON("/health"),
  getBuildings: () => requestJSON("/buildings"),
  getBuilding: (id) => requestJSON(`/buildings/${id}`),
  updateBuilding: (id, data) =>
    requestJSON(`/buildings/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getFloors: (buildingId = 1) =>
    requestJSON(`/floors${buildingId ? `?building_id=${buildingId}` : ""}`),
  createFloor: (data) =>
    requestJSON("/floors", { method: "POST", body: JSON.stringify(data) }),
  deleteFloor: (id) => requestJSON(`/floors/${id}`, { method: "DELETE" }),
  getFloorGeoJSON: (floorId) => requestJSON(`/floors/${floorId}/geojson`),

  getRooms: ({ buildingId, floorId, level, q } = {}) => {
    const params = new URLSearchParams();
    if (buildingId !== undefined && buildingId !== null) params.set("building_id", buildingId);
    if (floorId !== undefined && floorId !== null) params.set("floor_id", floorId);
    if (level !== undefined && level !== null) params.set("level", level);
    if (q) params.set("q", q);
    const qs = params.toString();
    return requestJSON(`/rooms${qs ? `?${qs}` : ""}`);
  },
  createRoom: (data) =>
    requestJSON("/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (id, data) =>
    requestJSON(`/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteRoom: (id) => requestJSON(`/rooms/${id}`, { method: "DELETE" }),

  getAdminStats: () => requestJSON("/admin/stats"),
  login: (username, password) =>
    requestJSON("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
};
