import { IndoorAPI } from "./api.js?v=4";

let buildingCache = null;
let floorsCache = [];
let roomsCache = [];

// Estado do Editor Visual de Desenho no Mapa (/admin)
let drawMap = null;
let drawMapLoaded = false;
let drawnLabelMarker = null;
let drawMode = "rect"; // "rect" (arrastar ou 2 cliques) | "poly" (vários pontos) | "pan" (mover mapa)
let rectStartCorner = null;
let rectDragCandidate = null;
let isDraggingRect = false;
let isPolyLocked = false;
let draggingVertexIndex = null;
let vertexDragStartScreen = null;
let suppressNextClick = false;
let drawnVertices = []; // Array de [lng, lat] sem repetir o ponto de fechamento
let hoverCoord = null;
let editingRoomId = null;
let currentFloorGeoJSON = null;
let showOtherRooms = true;

const AUTH_KEY = "tc_indoor_admin_auth";
let adminSearchQuery = "";
let adminFilterFloorId = "all";

document.addEventListener("DOMContentLoaded", () => {
  bindAdminEvents();
  checkAuth();
});

function checkAuth() {
  const token = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
  const loginView = document.getElementById("adminLoginView");
  const dashView = document.getElementById("adminDashboardView");

  if (token) {
    loginView?.classList.add("hidden");
    dashView?.classList.remove("hidden");
    const user = JSON.parse(sessionStorage.getItem("tc_indoor_admin_user") || '{"username":"admin"}');
    const badge = document.getElementById("adminUsernameBadge");
    if (badge) badge.textContent = user.username || "admin";
    refreshAllAdminData();
  } else {
    loginView?.classList.remove("hidden");
    dashView?.classList.add("hidden");
  }
}

async function refreshAllAdminData() {
  try {
    const [stats, buildings, floors, rooms] = await Promise.all([
      IndoorAPI.getAdminStats(),
      IndoorAPI.getBuildings(),
      IndoorAPI.getFloors(1),
      IndoorAPI.getRooms(),
    ]);

    buildingCache = buildings[0] || null;
    floorsCache = floors;
    roomsCache = rooms;

    document.getElementById("statBuildings").textContent = stats.buildings_count;
    document.getElementById("statFloors").textContent = stats.floors_count;
    document.getElementById("statRooms").textContent = stats.rooms_count;

    const badgeRooms = document.getElementById("tabBadgeRooms");
    if (badgeRooms) badgeRooms.textContent = stats.rooms_count;
    const badgeFloors = document.getElementById("tabBadgeFloors");
    if (badgeFloors) badgeFloors.textContent = stats.floors_count;

    if (buildingCache) {
      document.getElementById("buildingId").value = buildingCache.id;
      document.getElementById("buildingName").value = buildingCache.name;
      document.getElementById("buildingAddress").value = buildingCache.address;
      document.getElementById("buildingLat").value = buildingCache.latitude;
      document.getElementById("buildingLon").value = buildingCache.longitude;
    }

    renderFloorsTable(floors);
    renderModalFloorSelect(floors);
    populateAdminFloorFilter(floors);
    filterAndRenderAdminRooms();
  } catch (err) {
    console.error("Erro no painel admin:", err);
    alert(`Erro ao carregar dados do painel: ${err.message}`);
  }
}

function renderFloorsTable(floors) {
  const tbody = document.getElementById("tableFloorsBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (const fl of floors) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${fl.id}</strong></td>
      <td><strong>${fl.name}</strong></td>
      <td>Nível ${fl.level}</td>
      <td><span class="tab-badge" style="background:#dbeafe; color:#1d4ed8; font-weight:700;">${fl.rooms_count} salas</span></td>
      <td style="text-align: right;">
        <button class="btn-action-delete" data-del-floor="${fl.id}">🗑️ Excluir</button>
      </td>
    `;
    tr.querySelector("[data-del-floor]").addEventListener("click", async () => {
      if (!confirm(`Deseja realmente excluir o andar "${fl.name}"?`)) return;
      await IndoorAPI.deleteFloor(fl.id);
      await refreshAllAdminData();
    });
    tbody.appendChild(tr);
  }
}

function renderModalFloorSelect(floors) {
  const sel = document.getElementById("modalRoomFloorId");
  if (!sel) return;
  sel.innerHTML = "";
  for (const fl of floors) {
    const opt = document.createElement("option");
    opt.value = fl.id;
    opt.textContent = `${fl.name} (Nível ${fl.level})`;
    sel.appendChild(opt);
  }
}

function populateAdminFloorFilter(floors) {
  const sel = document.getElementById("adminFloorFilter");
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '<option value="all">Todos os Andares</option>';
  for (const fl of floors) {
    const opt = document.createElement("option");
    opt.value = fl.id;
    opt.textContent = `${fl.name} (Nível ${fl.level})`;
    sel.appendChild(opt);
  }
  if ([...sel.options].some((o) => o.value === currentVal)) {
    sel.value = currentVal;
  }
}

function filterAndRenderAdminRooms() {
  const q = adminSearchQuery.trim().toLowerCase();
  const filtered = roomsCache.filter((r) => {
    if (adminFilterFloorId !== "all" && String(r.floor_id) !== String(adminFilterFloorId)) {
      return false;
    }
    if (!q) return true;
    return (
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  const countLabel = document.getElementById("adminRoomsCountLabel");
  if (countLabel) {
    countLabel.textContent = `${filtered.length} ${filtered.length === 1 ? "setor" : "setores"}`;
  }

  renderRoomsTableRows(filtered);
}

function renderRoomsTableRows(rooms) {
  const tbody = document.getElementById("tableRoomsBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (rooms.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 28px; color: var(--text-muted);">
          Nenhuma sala ou setor encontrado para o filtro aplicado.
        </td>
      </tr>
    `;
    return;
  }

  for (const r of rooms) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="code-pill cat-${r.category}">${r.code}</span></td>
      <td><strong>${r.name}</strong></td>
      <td style="color:#2563eb; font-weight:500;">${r.department}</td>
      <td><span class="floor-tag-table">📍 ${r.floor_name}</span></td>
      <td style="font-size:12px; color:var(--text-muted);">${r.opening_hours || "08:00 às 17:00"}</td>
      <td style="text-align: right;">
        <div class="table-actions" style="justify-content: flex-end;">
          <button class="btn-action-edit" data-edit-room="${r.id}">✏️ Editar / Desenho</button>
          <button class="btn-action-delete" data-del-room="${r.id}" title="Excluir sala">🗑️</button>
        </div>
      </td>
    `;

    tr.querySelector("[data-edit-room]").addEventListener("click", () => {
      openRoomMapModal(r);
    });

    tr.querySelector("[data-del-room]").addEventListener("click", async () => {
      if (!confirm(`Remover a sala "${r.name} - ${r.department}"?`)) return;
      await IndoorAPI.deleteRoom(r.id);
      await refreshAllAdminData();
    });

    tbody.appendChild(tr);
  }
}

// ============================================================================
// EDITOR VISUAL DE DESENHO DE SALAS E SETORES NO MAPA (/admin)
// ============================================================================

async function openRoomMapModal(room = null) {
  editingRoomId = room ? room.id : null;
  rectStartCorner = null;
  rectDragCandidate = null;
  isDraggingRect = false;
  isPolyLocked = false;
  draggingVertexIndex = null;
  vertexDragStartScreen = null;
  hoverCoord = null;
  drawnVertices = [];

  document.getElementById("roomModalTitle").textContent = room
    ? `✏️ Editar Setor no Mapa: ${room.name} (${room.code})`
    : "🗺️ Cadastrar e Desenhar Novo Setor no Mapa";

  document.getElementById("modalRoomId").value = room ? room.id : "";
  document.getElementById("modalRoomFloorId").value = room
    ? String(room.floor_id)
    : floorsCache[0]
      ? String(floorsCache[0].id)
      : "1";
  document.getElementById("modalRoomCode").value = room ? room.code : "";
  document.getElementById("modalRoomName").value = room ? room.name : "";
  document.getElementById("modalRoomDept").value = room ? room.department : "";
  document.getElementById("modalRoomDesc").value = room ? room.description || "" : "";
  document.getElementById("modalRoomCategory").value = room ? room.category || "service" : "service";
  document.getElementById("modalRoomHours").value = room
    ? room.opening_hours || "08:00 às 17:00"
    : "08:00 às 17:00";

  // Se estiver editando uma sala que já tem geometria, carrega os vértices atuais
  if (
    room &&
    room.geometry &&
    room.geometry.type === "Polygon" &&
    Array.isArray(room.geometry.coordinates) &&
    room.geometry.coordinates[0]
  ) {
    const ring = room.geometry.coordinates[0];
    drawnVertices = ring
      .slice(0, Math.max(3, ring.length - 1))
      .map((pt) => [Number(pt[0]), Number(pt[1])]);
    isPolyLocked = true;
  }

  document.getElementById("roomMapModal").classList.remove("hidden");

  // Aguarda o navegador renderizar o modal para que o canvas tenha dimensões reais
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  await ensureAdminDrawMapInitialized();
  drawMap.resize();

  if (drawnVertices.length >= 3 && drawnVertices.length !== 4) {
    setDrawMode("poly", true);
  } else {
    setDrawMode("rect", true);
  }

  const selectedFloorId = Number(document.getElementById("modalRoomFloorId").value);
  await loadFloorIntoDrawMap(selectedFloorId);
  fitDrawMapToCurrentFloor();
  updateDrawLayers();
}

function closeRoomMapModal() {
  document.getElementById("roomMapModal").classList.add("hidden");
  rectStartCorner = null;
  rectDragCandidate = null;
  isDraggingRect = false;
  draggingVertexIndex = null;
  hoverCoord = null;
}

async function ensureAdminDrawMapInitialized() {
  if (drawMap && drawMapLoaded) {
    return;
  }

  const center = buildingCache
    ? [Number(buildingCache.longitude), Number(buildingCache.latitude)]
    : [-45.26903, -21.67083];

  drawMap = new maplibregl.Map({
    container: "adminDrawMap",
    style: "https://tiles.openfreemap.org/styles/dark",
    center,
    zoom: 19.2,
    pitch: 0,
    bearing: 0,
    maxZoom: 22,
    minZoom: 15,
    doubleClickZoom: false,
  });

  drawMap.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");

  await new Promise((resolve) => {
    drawMap.on("load", () => {
      setupDrawMapLayers();
      setupDrawMapInteractions();
      drawMapLoaded = true;
      resolve();
    });
  });
}

function setupDrawMapLayers() {
  const emptyFC = { type: "FeatureCollection", features: [] };

  // Separamos sources de geometria e de rótulos para que NENHUMA falha ou atraso
  // de fonte externa bloqueie a renderização imediata dos polígonos no WebGL
  drawMap.addSource("admin-floor-base", { type: "geojson", data: emptyFC });
  drawMap.addSource("admin-floor-labels", { type: "geojson", data: emptyFC });
  drawMap.addSource("admin-draw-shape", { type: "geojson", data: emptyFC });

  // 1. Salas já cadastradas neste andar (geometria sempre visível sobre o mapa)
  drawMap.addLayer({
    id: "admin-existing-rooms-fill",
    type: "fill",
    source: "admin-floor-base",
    filter: ["==", ["get", "layer_type"], "room"],
    paint: {
      "fill-color": [
        "match",
        ["get", "category"],
        "reception",
        "#10b981",
        "service",
        "#3b82f6",
        "admin",
        "#8b5cf6",
        "vertical_circulation",
        "#f59e0b",
        "facility",
        "#64748b",
        "#64748b",
      ],
      "fill-opacity": 0.42,
    },
  });

  drawMap.addLayer({
    id: "admin-existing-rooms-border",
    type: "line",
    source: "admin-floor-base",
    filter: ["==", ["get", "layer_type"], "room"],
    paint: {
      "line-color": "#38bdf8",
      "line-width": 2,
      "line-dasharray": [2, 2],
    },
  });

  drawMap.addLayer({
    id: "admin-existing-rooms-label",
    type: "symbol",
    source: "admin-floor-labels",
    filter: ["==", ["get", "layer_type"], "room_label"],
    layout: {
      "text-field": ["concat", ["get", "code"], " - ", ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-anchor": "center",
    },
    paint: {
      "text-color": "#f0f9ff",
      "text-halo-color": "#040d1a",
      "text-halo-width": 2.5,
    },
  });

  // ==========================================================================
  // 2. CAMADAS DO SETOR SENDO DESENHADO PELO ADMIN (100% WebGL, zero symbol)
  // ==========================================================================

  // 2.1 Preenchimento colorido e vibrante do polígono sendo desenhado
  drawMap.addLayer({
    id: "admin-drawn-poly-fill",
    type: "fill",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_polygon"],
    paint: {
      "fill-color": [
        "case",
        ["boolean", ["get", "is_active_drag"], false],
        "#f97316",
        [
          "match",
          ["get", "category"],
          "reception",
          "#10b981",
          "service",
          "#2563eb",
          "admin",
          "#7c3aed",
          "vertical_circulation",
          "#f59e0b",
          "facility",
          "#475569",
          "#2563eb",
        ],
      ],
      "fill-opacity": 0.58,
    },
  });

  // 2.2 Halo branco externo do polígono
  drawMap.addLayer({
    id: "admin-drawn-poly-halo",
    type: "line",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_polygon"],
    paint: {
      "line-color": "#ffffff",
      "line-width": 7,
      "line-opacity": 0.95,
    },
  });

  // 2.3 Borda principal vibrante do setor desenhado
  drawMap.addLayer({
    id: "admin-drawn-poly-line",
    type: "line",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_polygon"],
    paint: {
      "line-color": [
        "case",
        ["boolean", ["get", "is_active_drag"], false],
        "#ea580c",
        "#1d4ed8",
      ],
      "line-width": 3.5,
    },
  });

  // 2.4 Halo e linha para segmento inicial (quando há apenas 2 cantos clicados)
  drawMap.addLayer({
    id: "admin-drawn-segment-halo",
    type: "line",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_line"],
    paint: {
      "line-color": "#ffffff",
      "line-width": 6,
      "line-opacity": 0.9,
    },
  });

  drawMap.addLayer({
    id: "admin-drawn-segment-line",
    type: "line",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_line"],
    paint: {
      "line-color": "#ea580c",
      "line-width": 3.5,
    },
  });

  // 2.5 Linha guia tracejada (preview do próximo ponto no modo Polígono Livre)
  drawMap.addLayer({
    id: "admin-drawn-guide-line",
    type: "line",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_guide"],
    paint: {
      "line-color": "#f97316",
      "line-width": 2.5,
      "line-dasharray": [2, 2],
    },
  });

  // 2.6 Alças nos cantos (vértices) para visualização e ajuste
  drawMap.addLayer({
    id: "admin-drawn-vertices",
    type: "circle",
    source: "admin-draw-shape",
    filter: ["==", ["get", "feature_type"], "drawn_vertex"],
    paint: {
      "circle-radius": [
        "case",
        ["boolean", ["get", "is_first"], false],
        9,
        7.5,
      ],
      "circle-color": [
        "case",
        ["boolean", ["get", "is_first"], false],
        "#fef3c7",
        "#ffffff",
      ],
      "circle-stroke-width": 3,
      "circle-stroke-color": [
        "case",
        ["boolean", ["get", "is_first"], false],
        "#1d4ed8",
        "#ea580c",
      ],
    },
  });
}

function updateDrawnCenterMarker(centroid, titleLine, dimText) {
  if (!drawMap) return;

  if (!centroid) {
    if (drawnLabelMarker) {
      drawnLabelMarker.remove();
      drawnLabelMarker = null;
    }
    return;
  }

  if (!drawnLabelMarker) {
    const el = document.createElement("div");
    el.style.cssText = `
      pointer-events: none;
      background: rgba(15, 23, 42, 0.9);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 700;
      text-align: center;
      line-height: 1.35;
      white-space: nowrap;
      border: 1.5px solid #ffffff;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.28);
    `;
    drawnLabelMarker = new maplibregl.Marker({ element: el, anchor: "center" });
  }

  const el = drawnLabelMarker.getElement();
  el.innerHTML = dimText
    ? `<div>${escapeHtml(titleLine)}</div><div style="font-size:10.5px; color:#fed7aa; font-weight:600;">📐 ${escapeHtml(dimText)}</div>`
    : `<div>${escapeHtml(titleLine)}</div>`;

  drawnLabelMarker.setLngLat(centroid).addTo(drawMap);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findNearbyVertexIndex(lngLat) {
  if (!drawMap || drawnVertices.length === 0) return -1;
  const targetPoint = drawMap.project(lngLat);
  for (let i = 0; i < drawnVertices.length; i++) {
    const vScreen = drawMap.project(drawnVertices[i]);
    const distPx = Math.hypot(vScreen.x - targetPoint.x, vScreen.y - targetPoint.y);
    if (distPx <= 16) {
      return i;
    }
  }
  return -1;
}

function makeRectVertices(cornerA, cornerB) {
  const [x1, y1] = cornerA;
  const [x2, y2] = cornerB;
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

function distanceMeters(coordA, coordB) {
  const [lng1, lat1] = coordA;
  const [lng2, lat2] = coordB;
  const avgLatRad = (((lat1 + lat2) / 2) * Math.PI) / 180;
  const dx = (lng2 - lng1) * 111320 * Math.cos(avgLatRad);
  const dy = (lat2 - lat1) * 111132;
  return {
    widthM: Math.abs(dx),
    heightM: Math.abs(dy),
    distM: Math.hypot(dx, dy),
  };
}

function setupDrawMapInteractions() {
  const canvas = drawMap.getCanvas();

  // Quando o mouse sai do mapa em direção ao formulário lateral, remove a linha-guia
  // mantendo o polígono desenhado 100% fixo na tela
  canvas.addEventListener("mouseleave", () => {
    if (hoverCoord !== null && !isDraggingRect && draggingVertexIndex === null) {
      hoverCoord = null;
      updateDrawLayers();
    }
  });

  drawMap.on("mousedown", (e) => {
    if (e.originalEvent.button !== 0 || drawMode === "pan") return;

    const coord = [
      Number(e.lngLat.lng.toFixed(7)),
      Number(e.lngLat.lat.toFixed(7)),
    ];

    // Se clicou em cima de um canto (vértice) existente, permite arrastar esse canto
    const hitVertexIdx = findNearbyVertexIndex(e.lngLat);
    if (hitVertexIdx !== -1 && !rectStartCorner) {
      draggingVertexIndex = hitVertexIdx;
      vertexDragStartScreen = drawMap.project(e.lngLat);
      suppressNextClick = true;
      canvas.style.cursor = "grabbing";
      e.preventDefault();
      return;
    }

    // No modo Retângulo, registra candidato a arraste sem apagar um polígono já existente por acidente
    if (drawMode === "rect" && !rectStartCorner) {
      rectDragCandidate = coord;
      hoverCoord = coord;
      e.preventDefault();
    }
  });

  drawMap.on("mousemove", (e) => {
    const coord = [
      Number(e.lngLat.lng.toFixed(7)),
      Number(e.lngLat.lat.toFixed(7)),
    ];
    hoverCoord = coord;

    if (draggingVertexIndex !== null) {
      if (drawMode === "rect" && drawnVertices.length === 4) {
        const oppositeIdx = (draggingVertexIndex + 2) % 4;
        const oppositeCorner = drawnVertices[oppositeIdx];
        drawnVertices = makeRectVertices(oppositeCorner, coord);
        draggingVertexIndex = 2;
      } else {
        drawnVertices[draggingVertexIndex] = coord;
      }
      updateDrawLayers();
      return;
    }

    // Se o usuário começou a arrastar no modo Retângulo
    if (drawMode === "rect" && rectDragCandidate && !rectStartCorner) {
      const { distM } = distanceMeters(rectDragCandidate, coord);
      if (distM > 0.35) {
        rectStartCorner = rectDragCandidate;
        isDraggingRect = true;
        drawnVertices = makeRectVertices(rectStartCorner, coord);
        updateDrawLayers();
        return;
      }
    }

    if (drawMode !== "pan") {
      const nearIdx = findNearbyVertexIndex(e.lngLat);
      canvas.style.cursor = nearIdx !== -1 && !rectStartCorner ? "grab" : "crosshair";
      if (rectStartCorner || (drawMode === "poly" && drawnVertices.length > 0 && !isPolyLocked)) {
        updateDrawLayers();
      }
    }
  });

  drawMap.on("mouseup", (e) => {
    if (e.originalEvent.button !== 0 || drawMode === "pan") return;

    const coord = [
      Number(e.lngLat.lng.toFixed(7)),
      Number(e.lngLat.lat.toFixed(7)),
    ];

    if (draggingVertexIndex !== null) {
      const endScreen = drawMap.project(e.lngLat);
      const movedPx = vertexDragStartScreen
        ? Math.hypot(endScreen.x - vertexDragStartScreen.x, endScreen.y - vertexDragStartScreen.y)
        : 99;

      // Se clicou no 1º canto (ou qualquer canto existente) sem arrastar no modo Polígono Livre com >=3 cantos, fixa o polígono!
      if (drawMode === "poly" && !isPolyLocked && drawnVertices.length >= 3 && movedPx <= 5) {
        isPolyLocked = true;
      }

      draggingVertexIndex = null;
      vertexDragStartScreen = null;
      canvas.style.cursor = "crosshair";
      updateDrawLayers();
      return;
    }

    rectDragCandidate = null;

    if (drawMode === "rect" && isDraggingRect && rectStartCorner) {
      isDraggingRect = false;
      const { distM } = distanceMeters(rectStartCorner, coord);
      if (distM > 0.35) {
        drawnVertices = makeRectVertices(rectStartCorner, coord);
        isPolyLocked = true;
        rectStartCorner = null;
        suppressNextClick = true;
        updateDrawLayers();
      }
    }
  });

  drawMap.on("click", (e) => {
    if (drawMode === "pan") return;
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }

    const coord = [
      Number(e.lngLat.lng.toFixed(7)),
      Number(e.lngLat.lat.toFixed(7)),
    ];

    if (drawMode === "rect") {
      if (!rectStartCorner) {
        rectStartCorner = coord;
        hoverCoord = coord;
      } else {
        const { distM } = distanceMeters(rectStartCorner, coord);
        if (distM > 0.25) {
          drawnVertices = makeRectVertices(rectStartCorner, coord);
          isPolyLocked = true;
          rectStartCorner = null;
        }
      }
    } else if (drawMode === "poly") {
      if (isPolyLocked) {
        // Quando o polígono já está fixado, cliques simples não deformam o polígono;
        // o usuário pode arrastar qualquer canto para ajustar ou clicar em Desfazer/Limpar.
        return;
      }

      // Evita adicionar dois vértices idênticos consecutivos (ex: em duplo-clique)
      if (drawnVertices.length > 0) {
        const lastPt = drawnVertices[drawnVertices.length - 1];
        if (distanceMeters(lastPt, coord).distM < 0.15) {
          if (drawnVertices.length >= 3) {
            isPolyLocked = true;
            updateDrawLayers();
          }
          return;
        }
      }

      drawnVertices.push(coord);
    }

    updateDrawLayers();
  });

  // Duplo-clique no modo Polígono Livre fixa imediatamente o polígono na tela
  drawMap.on("dblclick", (e) => {
    e.preventDefault();
    if (drawMode === "poly" && drawnVertices.length >= 3) {
      isPolyLocked = true;
      updateDrawLayers();
    }
  });
}

async function loadFloorIntoDrawMap(floorId) {
  if (!drawMap || !drawMapLoaded) return;
  const geojson = await IndoorAPI.getFloorGeoJSON(floorId);
  currentFloorGeoJSON = geojson;

  let filteredFeatures = (geojson && geojson.features) || [];
  if (editingRoomId) {
    filteredFeatures = filteredFeatures.filter(
      (f) => !(f.properties && Number(f.properties.id) === Number(editingRoomId))
    );
  }

  const geomFeatures = filteredFeatures.filter(
    (f) => f.properties && f.properties.layer_type !== "room_label"
  );
  const labelFeatures = filteredFeatures.filter(
    (f) => f.properties && f.properties.layer_type === "room_label"
  );

  const src = drawMap.getSource("admin-floor-base");
  if (src) {
    src.setData({
      type: "FeatureCollection",
      features: geomFeatures,
    });
  }

  const labelSrc = drawMap.getSource("admin-floor-labels");
  if (labelSrc) {
    labelSrc.setData({
      type: "FeatureCollection",
      features: labelFeatures,
    });
  }
}

function fitDrawMapToCurrentFloor() {
  if (!drawMap || !drawMapLoaded) return;

  if (drawnVertices.length >= 3) {
    const sum = drawnVertices.reduce(
      (acc, pt) => [acc[0] + pt[0], acc[1] + pt[1]],
      [0, 0]
    );
    drawMap.easeTo({
      center: [sum[0] / drawnVertices.length, sum[1] / drawnVertices.length],
      zoom: 19.3,
      duration: 350,
    });
    return;
  }

  if (buildingCache) {
    drawMap.easeTo({
      center: [Number(buildingCache.longitude), Number(buildingCache.latitude)],
      zoom: 19.2,
      duration: 350,
    });
  }
}

function computePolygonMetrics(vertices) {
  if (!vertices || vertices.length < 2) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of vertices) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  const { widthM, heightM, distM } = distanceMeters([minLng, minLat], [maxLng, maxLat]);
  const areaM2 = widthM * heightM;
  return { widthM, heightM, distM, areaM2 };
}

function updateDrawLayers() {
  if (!drawMap || !drawMapLoaded) return;
  const src = drawMap.getSource("admin-draw-shape");
  if (!src) return;

  const features = [];
  const category = document.getElementById("modalRoomCategory").value || "service";
  const roomCode = document.getElementById("modalRoomCode").value.trim();
  const roomName = document.getElementById("modalRoomName").value.trim() || "Novo Setor";
  const titleLine = roomCode ? `[${roomCode}] ${roomName}` : roomName;

  // Vértices efetivos do polígono:
  // - No modo Retângulo enquanto escolhe o 2º canto, mostra o preview do retângulo
  // - No modo Polígono Livre (e demais modos), assim que houver >= 3 cantos clicados,
  //   o polígono é SEMPRE fixado nos cantos clicados (drawnVertices), sem deformar com o mouse!
  let activePolyVertices = [...drawnVertices];
  if (drawMode === "rect" && rectStartCorner && hoverCoord) {
    const { distM } = distanceMeters(rectStartCorner, hoverCoord);
    if (distM > 0.1) {
      activePolyVertices = makeRectVertices(rectStartCorner, hoverCoord);
    } else if (drawnVertices.length === 0) {
      activePolyVertices = [rectStartCorner];
    }
  }

  // Linha-guia tracejada para o mouse no modo Polígono Livre (enquanto não fixado)
  if (drawMode === "poly" && !isPolyLocked && hoverCoord && drawnVertices.length > 0) {
    const lastPt = drawnVertices[drawnVertices.length - 1];
    const firstPt = drawnVertices[0];
    const guideCoords =
      drawnVertices.length >= 2
        ? [lastPt, hoverCoord, firstPt]
        : [lastPt, hoverCoord];
    features.push({
      type: "Feature",
      properties: {
        feature_type: "drawn_guide",
      },
      geometry: {
        type: "LineString",
        coordinates: guideCoords,
      },
    });
  }

  const metrics = computePolygonMetrics(
    activePolyVertices.length >= 2
      ? activePolyVertices
      : drawMode === "poly" && drawnVertices.length === 1 && hoverCoord
        ? [drawnVertices[0], hoverCoord]
        : activePolyVertices
  );
  const metricsPill = document.getElementById("drawMetricsPill");

  if (activePolyVertices.length >= 3) {
    const closedRing = [...activePolyVertices, activePolyVertices[0]];
    const dimText = metrics
      ? `${metrics.widthM.toFixed(1)}m × ${metrics.heightM.toFixed(1)}m (${metrics.areaM2.toFixed(0)} m²)`
      : "";

    if (metricsPill && metrics) {
      metricsPill.textContent = `📐 ${dimText}`;
      metricsPill.classList.remove("hidden");
    }

    features.push({
      type: "Feature",
      properties: {
        feature_type: "drawn_polygon",
        category,
        is_active_drag: Boolean(rectStartCorner),
      },
      geometry: {
        type: "Polygon",
        coordinates: [closedRing],
      },
    });

    const sum = activePolyVertices.reduce(
      (acc, pt) => [acc[0] + pt[0], acc[1] + pt[1]],
      [0, 0]
    );
    const centroid = [
      sum[0] / activePolyVertices.length,
      sum[1] / activePolyVertices.length,
    ];
    updateDrawnCenterMarker(centroid, titleLine, dimText);
  } else if (activePolyVertices.length === 2) {
    updateDrawnCenterMarker(null);
    if (metricsPill && metrics) {
      metricsPill.textContent = `📏 Segmento: ${metrics.distM.toFixed(1)}m`;
      metricsPill.classList.remove("hidden");
    }
    features.push({
      type: "Feature",
      properties: {
        feature_type: "drawn_line",
        is_active_drag: true,
      },
      geometry: {
        type: "LineString",
        coordinates: activePolyVertices,
      },
    });
  } else {
    updateDrawnCenterMarker(null);
    if (metricsPill) {
      if (metrics && metrics.distM > 0.1) {
        metricsPill.textContent = `📏 Segmento: ${metrics.distM.toFixed(1)}m`;
        metricsPill.classList.remove("hidden");
      } else {
        metricsPill.classList.add("hidden");
      }
    }
  }

  // Pontos clicados / cantos (vértices)
  const vertexPoints =
    drawMode === "rect" && rectStartCorner
      ? activePolyVertices
      : drawnVertices;

  for (let i = 0; i < vertexPoints.length; i++) {
    features.push({
      type: "Feature",
      properties: {
        feature_type: "drawn_vertex",
        is_first: i === 0 && drawMode === "poly" && !isPolyLocked && vertexPoints.length >= 3,
      },
      geometry: {
        type: "Point",
        coordinates: vertexPoints[i],
      },
    });
  }

  src.setData({
    type: "FeatureCollection",
    features,
  });

  // Botão "Fixar Polígono" visível quando no modo Polígono Livre com >=3 cantos
  const lockBtn = document.getElementById("btnLockPoly");
  if (lockBtn) {
    if (drawMode === "poly" && drawnVertices.length >= 3) {
      lockBtn.classList.remove("hidden");
      if (isPolyLocked) {
        lockBtn.textContent = "✅ Polígono Fixado (Clique p/ +Cantos)";
        lockBtn.classList.remove("btn-emerald");
        lockBtn.classList.add("btn-outline");
      } else {
        lockBtn.textContent = "🔒 Fixar Polígono";
        lockBtn.classList.add("btn-emerald");
        lockBtn.classList.remove("btn-outline");
      }
    } else {
      lockBtn.classList.add("hidden");
    }
  }

  updateDrawStatusText();
}

function updateDrawStatusText() {
  const pill = document.getElementById("drawStatusPill");
  if (!pill) return;

  if (drawMode === "pan") {
    pill.textContent = "🖐️ Modo Mover Mapa: arraste para navegar ou clique em 'Retângulo' / 'Polígono Livre' para desenhar";
    return;
  }

  if (drawMode === "rect") {
    if (rectStartCorner) {
      pill.textContent = "📐 Mova o mouse e solte (ou clique no canto oposto) para fixar o retângulo!";
    } else if (drawnVertices.length >= 3) {
      pill.textContent = "✅ Setor fixado no mapa! Arraste os cantos para ajustar ou preencha os dados ao lado e salve";
    } else {
      pill.textContent = "👆 Clique e arraste no mapa (ou clique em 2 cantos) para desenhar o setor";
    }
  } else {
    if (drawnVertices.length === 0) {
      pill.textContent = "👆 Modo Polígono Livre: clique no 1º canto da sala sobre o mapa";
    } else if (drawnVertices.length === 1) {
      pill.textContent = "✏️ 1 canto marcado — clique no 2º canto da sala";
    } else if (drawnVertices.length === 2) {
      pill.textContent = "✏️ 2 cantos marcados — clique no 3º canto para formar e fixar o polígono!";
    } else if (isPolyLocked) {
      pill.textContent = `✅ Polígono com ${drawnVertices.length} cantos fixado! Arraste qualquer canto para ajustar ou salve ao lado`;
    } else {
      pill.textContent = `✅ Polígono com ${drawnVertices.length} cantos! Já pode salvar ao lado, clicar no 1º canto para travar ou clicar para +cantos`;
    }
  }
}

function setDrawMode(mode, keepLockState = false) {
  drawMode = mode;
  rectStartCorner = null;
  rectDragCandidate = null;
  isDraggingRect = false;
  draggingVertexIndex = null;
  if (!keepLockState && mode === "poly" && drawnVertices.length < 3) {
    isPolyLocked = false;
  }

  document.getElementById("btnModeRect").classList.toggle("btn-primary", mode === "rect");
  document.getElementById("btnModeRect").classList.toggle("btn-outline", mode !== "rect");
  document.getElementById("btnModePoly").classList.toggle("btn-primary", mode === "poly");
  document.getElementById("btnModePoly").classList.toggle("btn-outline", mode !== "poly");
  document.getElementById("btnModePan").classList.toggle("btn-primary", mode === "pan");
  document.getElementById("btnModePan").classList.toggle("btn-outline", mode !== "pan");

  if (drawMap) {
    if (mode === "pan") {
      drawMap.dragPan.enable();
      drawMap.getCanvas().style.cursor = "grab";
    } else {
      drawMap.dragPan.disable();
      drawMap.getCanvas().style.cursor = "crosshair";
    }
  }

  updateDrawLayers();
}

function toggleOtherRoomsVisibility() {
  showOtherRooms = !showOtherRooms;
  const visibility = showOtherRooms ? "visible" : "none";
  for (const layerId of [
    "admin-existing-rooms-fill",
    "admin-existing-rooms-border",
    "admin-existing-rooms-label",
  ]) {
    if (drawMap && drawMap.getLayer(layerId)) {
      drawMap.setLayoutProperty(layerId, "visibility", visibility);
    }
  }
  const btn = document.getElementById("btnToggleOtherRooms");
  if (btn) {
    btn.textContent = showOtherRooms ? "👁️ Outras Salas: Visíveis" : "🙈 Outras Salas: Ocultas";
  }
}

function bindAdminEvents() {
  // Login Administrativo
  const loginForm = document.getElementById("formAdminLogin");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById("loginUsername");
      const passwordInput = document.getElementById("loginPassword");
      const errorMsg = document.getElementById("loginErrorMsg");
      const errorText = document.getElementById("loginErrorText");
      const submitBtn = document.getElementById("btnLoginSubmit");

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = "<span>Entrando...</span>";
        }
        errorMsg?.classList.add("hidden");

        const res = await IndoorAPI.login(usernameInput.value.trim(), passwordInput.value);
        if (res.token) {
          sessionStorage.setItem(AUTH_KEY, res.token);
          sessionStorage.setItem(
            "tc_indoor_admin_user",
            JSON.stringify(res.user || { username: usernameInput.value })
          );
          checkAuth();
        }
      } catch (err) {
        errorMsg?.classList.remove("hidden");
        if (errorText) errorText.textContent = err.message || "Usuário ou senha incorretos.";
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "<span>Entrar no Painel</span><span>→</span>";
        }
      }
    });
  }

  // Logout
  const logoutBtn = document.getElementById("btnLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem("tc_indoor_admin_user");
      checkAuth();
    });
  }

  // Navegação por Abas (Tabs)
  const tabs = [
    { btn: "tabBtnRooms", pane: "tabContentRooms" },
    { btn: "tabBtnFloors", pane: "tabContentFloors" },
    { btn: "tabBtnBuilding", pane: "tabContentBuilding" },
  ];

  tabs.forEach(({ btn, pane }) => {
    const btnEl = document.getElementById(btn);
    if (!btnEl) return;
    btnEl.addEventListener("click", () => {
      tabs.forEach((t) => {
        document.getElementById(t.btn)?.classList.remove("active");
        document.getElementById(t.pane)?.classList.remove("active");
      });
      btnEl.classList.add("active");
      document.getElementById(pane)?.classList.add("active");
    });
  });

  // Busca e Filtro de Andar na Tabela de Salas do Admin
  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      adminSearchQuery = e.target.value;
      filterAndRenderAdminRooms();
    });
  }

  const floorFilter = document.getElementById("adminFloorFilter");
  if (floorFilter) {
    floorFilter.addEventListener("change", (e) => {
      adminFilterFloorId = e.target.value;
      filterAndRenderAdminRooms();
    });
  }

  // Salvar Prédio
  document.getElementById("formBuilding").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById("buildingId").value);
    await IndoorAPI.updateBuilding(id, {
      name: document.getElementById("buildingName").value,
      address: document.getElementById("buildingAddress").value,
      latitude: Number(document.getElementById("buildingLat").value),
      longitude: Number(document.getElementById("buildingLon").value),
    });
    alert("Dados do prédio atualizados com sucesso!");
    await refreshAllAdminData();
  });

  // Adicionar Andar
  document.getElementById("formAddFloor").addEventListener("submit", async (e) => {
    e.preventDefault();
    await IndoorAPI.createFloor({
      building_id: 1,
      name: document.getElementById("newFloorName").value,
      level: Number(document.getElementById("newFloorLevel").value),
    });
    e.target.reset();
    await refreshAllAdminData();
  });

  // Abrir Modal de Desenho de Sala
  document.getElementById("btnOpenDrawRoomModal").addEventListener("click", () => {
    openRoomMapModal(null);
  });
  document.getElementById("ctaDrawRoomBanner").addEventListener("click", () => {
    openRoomMapModal(null);
  });

  // Fechar Modal
  document.getElementById("btnCloseRoomMapModal").addEventListener("click", closeRoomMapModal);
  document.getElementById("btnCancelRoomModal").addEventListener("click", closeRoomMapModal);

  // Alternar modos de desenho e navegação
  document.getElementById("btnModeRect").addEventListener("click", () => setDrawMode("rect"));
  document.getElementById("btnModePoly").addEventListener("click", () => setDrawMode("poly"));
  document.getElementById("btnModePan").addEventListener("click", () => setDrawMode("pan"));

  // Botão Fixar / Destravar Polígono
  const lockBtn = document.getElementById("btnLockPoly");
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      if (drawnVertices.length >= 3) {
        isPolyLocked = !isPolyLocked;
        updateDrawLayers();
      }
    });
  }

  // Controles de visualização da planta
  document.getElementById("btnFitFloor").addEventListener("click", fitDrawMapToCurrentFloor);
  document.getElementById("btnToggleOtherRooms").addEventListener("click", toggleOtherRoomsVisibility);

  // Desfazer último ponto e Limpar desenho
  document.getElementById("btnUndoVertex").addEventListener("click", () => {
    if (rectStartCorner) {
      rectStartCorner = null;
      rectDragCandidate = null;
      isDraggingRect = false;
    } else if (drawnVertices.length > 0) {
      drawnVertices.pop();
      if (drawnVertices.length < 3) {
        isPolyLocked = false;
      }
    }
    updateDrawLayers();
  });

  document.getElementById("btnClearDraw").addEventListener("click", () => {
    rectStartCorner = null;
    rectDragCandidate = null;
    isDraggingRect = false;
    isPolyLocked = false;
    drawnVertices = [];
    updateDrawLayers();
  });

  // Trocar andar dentro do modal atualiza a planta no mapa imediatamente
  document.getElementById("modalRoomFloorId").addEventListener("change", async (e) => {
    const floorId = Number(e.target.value);
    await loadFloorIntoDrawMap(floorId);
    fitDrawMapToCurrentFloor();
  });

  // Atualizar preview de cor e rótulo em tempo real enquanto digita
  document.getElementById("modalRoomCategory").addEventListener("change", updateDrawLayers);
  document.getElementById("modalRoomCode").addEventListener("input", updateDrawLayers);
  document.getElementById("modalRoomName").addEventListener("input", updateDrawLayers);
  document.getElementById("modalRoomDept").addEventListener("input", updateDrawLayers);

  // Salvar Sala / Setor desenhado no mapa
  document.getElementById("formRoomModal").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (drawnVertices.length < 3) {
      alert("Por favor, desenhe a área da sala/setor (mínimo de 3 cantos) sobre o mapa antes de salvar.");
      return;
    }

    const closedCoordinates = [...drawnVertices, drawnVertices[0]];
    const geometry = {
      type: "Polygon",
      coordinates: [closedCoordinates],
    };

    const payload = {
      floor_id: Number(document.getElementById("modalRoomFloorId").value),
      code: document.getElementById("modalRoomCode").value.trim(),
      name: document.getElementById("modalRoomName").value.trim(),
      department: document.getElementById("modalRoomDept").value.trim(),
      description: document.getElementById("modalRoomDesc").value.trim(),
      category: document.getElementById("modalRoomCategory").value,
      opening_hours: document.getElementById("modalRoomHours").value.trim() || "08:00 às 17:00",
      geometry,
    };

    try {
      const roomId = document.getElementById("modalRoomId").value;
      if (roomId) {
        await IndoorAPI.updateRoom(Number(roomId), payload);
      } else {
        await IndoorAPI.createRoom(payload);
      }
      closeRoomMapModal();
      await refreshAllAdminData();
    } catch (err) {
      alert(`Erro ao salvar setor: ${err.message}`);
    }
  });
}
