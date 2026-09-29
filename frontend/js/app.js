import { IndoorAPI } from "./api.js?v=6";
import { IndoorMapController } from "./map.js?v=6";

const state = {
  building: null,
  floors: [],
  rooms: [],
  activeFloorId: null,
  roomFilterFloorId: "all",
  searchQuery: "",
  selectedRoom: null,
};

let mapCtrl = null;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApp();
  } catch (err) {
    console.error("Erro ao inicializar aplicação:", err);
    alert(`Não foi possível carregar os dados da API: ${err.message}`);
  }
});

async function refreshFloorAndRoomsData() {
  if (!state.building || !mapCtrl) return;
  try {
    state.floors = await IndoorAPI.getFloors(state.building.id);
    state.rooms = await IndoorAPI.getRooms({ buildingId: state.building.id });
    if (state.activeFloorId) {
      await loadFloorOnMap(state.activeFloorId);
    }
    renderFloorSwitchers();
    renderRoomFilterPills();
    renderRoomsList();
  } catch (err) {
    console.warn("Falha ao atualizar dados do mapa:", err);
  }
}

window.addEventListener("pageshow", () => {
  refreshFloorAndRoomsData();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshFloorAndRoomsData();
  }
});

async function initApp() {
  const buildings = await IndoorAPI.getBuildings();
  if (!buildings || !buildings.length) {
    throw new Error("Nenhum prédio cadastrado no banco PostGIS.");
  }

  state.building = buildings[0];
  state.floors = await IndoorAPI.getFloors(state.building.id);
  state.rooms = await IndoorAPI.getRooms({ buildingId: state.building.id });

  // Inicializa MapLibre
  mapCtrl = new IndoorMapController({
    containerId: "map",
    center: [state.building.longitude, state.building.latitude],
    onRoomClick: (roomProps) => handleRoomSelect(Number(roomProps.id)),
    onEnterIndoor: () => enterIndoorMap(),
  });

  await mapCtrl.init();
  mapCtrl.setBuildingMarker(state.building);
  const bannerTitle = document.getElementById("outdoorBannerTitle");
  if (bannerTitle && state.building.name) {
    bannerTitle.textContent = `📍 ${state.building.name}`;
  }

  // Seleciona o Térreo por padrão
  if (state.floors.length > 0) {
    state.activeFloorId = state.floors[0].id;
    await loadFloorOnMap(state.activeFloorId);
  }

  renderFloorSwitchers();
  renderRoomFilterPills();
  renderRoomsList();
  bindUIEvents();
  checkURLParametersForQRCode();
}

async function loadFloorOnMap(floorId) {
  state.activeFloorId = Number(floorId);
  const geojson = await IndoorAPI.getFloorGeoJSON(state.activeFloorId);
  mapCtrl.setFloorGeoJSON(state.activeFloorId, geojson);
  renderFloorSwitchers();
}

async function switchFloor(floorId) {
  await loadFloorOnMap(floorId);
}

function enterIndoorMap() {
  mapCtrl.enterIndoorView();
  document.getElementById("outdoorBanner").classList.add("hidden");
  document.getElementById("btnToggleViewMode").textContent = "🌍 Visão Externa (Cidade)";
}

function toggleOutdoorIndoorView() {
  if (mapCtrl.isIndoorMode) {
    mapCtrl.exitToOutdoorView();
    document.getElementById("outdoorBanner").classList.remove("hidden");
    document.getElementById("btnToggleViewMode").textContent = "🏢 Entrar no Mapa Interno";
  } else {
    enterIndoorMap();
  }
}

function renderFloorSwitchers() {
  const container = document.getElementById("floorSwitcher");
  container.innerHTML = "";

  for (const fl of state.floors) {
    const btn = document.createElement("button");
    btn.className = `floor-btn ${fl.id === state.activeFloorId ? "active" : ""}`;
    btn.textContent = fl.name;
    btn.addEventListener("click", () => {
      if (!mapCtrl.isIndoorMode) enterIndoorMap();
      switchFloor(fl.id);
    });
    container.appendChild(btn);
  }
}

function renderRoomFilterPills() {
  const container = document.getElementById("floorFilterPills");
  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `filter-pill ${state.roomFilterFloorId === "all" ? "active" : ""}`;
  allBtn.textContent = "Todos os Andares";
  allBtn.addEventListener("click", () => {
    state.roomFilterFloorId = "all";
    renderRoomFilterPills();
    renderRoomsList();
  });
  container.appendChild(allBtn);

  for (const fl of state.floors) {
    const btn = document.createElement("button");
    btn.className = `filter-pill ${state.roomFilterFloorId === fl.id ? "active" : ""}`;
    btn.textContent = fl.name;
    btn.addEventListener("click", () => {
      state.roomFilterFloorId = fl.id;
      renderRoomFilterPills();
      renderRoomsList();
      switchFloor(fl.id);
    });
    container.appendChild(btn);
  }
}

function renderRoomsList() {
  const listEl = document.getElementById("roomsList");
  listEl.innerHTML = "";

  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.rooms.filter((r) => {
    if (state.roomFilterFloorId !== "all" && r.floor_id !== state.roomFilterFloorId) {
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

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding: 24px 12px; color: var(--text-muted); font-size: 13px;">
        Nenhuma sala ou serviço encontrado para "<strong>${state.searchQuery}</strong>".
      </div>
    `;
    return;
  }

  for (const room of filtered) {
    const card = document.createElement("div");
    const isSelected = state.selectedRoom && state.selectedRoom.id === room.id;
    card.className = `room-card ${isSelected ? "selected" : ""}`;
    card.innerHTML = `
      <div>
        <span class="room-code-badge cat-${room.category}">${room.code}</span>
        <div class="room-title">${room.name}</div>
        <div class="room-dept">${room.department}</div>
        ${room.description ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:4px; line-height:1.35;">${room.description}</div>` : ""}
      </div>
      <span class="room-floor-tag">${room.floor_name}</span>
    `;
    card.addEventListener("click", () => handleRoomSelect(room.id));
    listEl.appendChild(card);
  }
}

async function handleRoomSelect(roomId) {
  const room = state.rooms.find((r) => r.id === Number(roomId));
  if (!room) return;

  state.selectedRoom = room;
  if (!mapCtrl.isIndoorMode) {
    enterIndoorMap();
  }
  if (state.activeFloorId !== room.floor_id) {
    await switchFloor(room.floor_id);
  }

  mapCtrl.highlightRoom(room.id);
  mapCtrl.focusRoom(room);
  renderRoomsList();
  showRoomDetailDrawer(room);
}

function showRoomDetailDrawer(room) {
  const drawer = document.getElementById("roomDetailDrawer");
  drawer.classList.remove("hidden");

  document.getElementById("detailRoomCode").textContent = `Código: ${room.code}`;
  document.getElementById("detailRoomName").textContent = room.name;
  document.getElementById("detailRoomDept").textContent = room.department;
  const floorEl = document.getElementById("detailRoomFloor");
  if (floorEl) {
    floorEl.textContent = `📍 Andar: ${room.floor_name}`;
  }
  document.getElementById("detailRoomDesc").textContent =
    room.description || "Atendimento presencial ao cidadão.";
  document.getElementById("detailRoomHours").textContent =
    `🕒 Horário: ${room.opening_hours || "08:00 às 17:00"}`;
}

function bindUIEvents() {
  document.getElementById("searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderRoomsList();
  });

  document.getElementById("btnEnterIndoorBanner").addEventListener("click", () => enterIndoorMap());
  document.getElementById("btnToggleViewMode").addEventListener("click", () => toggleOutdoorIndoorView());
  document.getElementById("btnToggle3D").addEventListener("click", () => mapCtrl.toggle3DPitch());

  document.getElementById("btnCloseDetailDrawer").addEventListener("click", () => {
    document.getElementById("roomDetailDrawer").classList.add("hidden");
    state.selectedRoom = null;
    mapCtrl.highlightRoom(-1);
    renderRoomsList();
  });

  // Modal QR Code
  document.getElementById("btnOpenQRModal").addEventListener("click", () => {
    updateQRModalLink();
    document.getElementById("qrModal").classList.remove("hidden");
  });

  document.getElementById("btnCloseQRModal").addEventListener("click", () => {
    document.getElementById("qrModal").classList.add("hidden");
  });
}

function updateQRModalLink() {
  const roomId = state.selectedRoom ? state.selectedRoom.id : "";
  const shareUrl = roomId
    ? `${window.location.origin}/?room=${roomId}`
    : `${window.location.origin}/`;
  document.getElementById("qrUrlInput").value = shareUrl;
  const qrImg = document.getElementById("qrCodeImage");
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
}

function checkURLParametersForQRCode() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room") || params.get("to_room");

  if (roomId) {
    handleRoomSelect(Number(roomId));
  }
}
