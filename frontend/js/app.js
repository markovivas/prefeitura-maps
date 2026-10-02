import { IndoorAPI } from "./api.js?v=8";
import { IndoorMapController } from "./map.js?v=10";

const state = {
  building: null,
  floors: [],
  rooms: [],
  activeFloorId: null,
  roomFilterFloorId: "all",
  searchQuery: "",
  activeQuickFilter: null,
  selectedRoom: null,
};

let mapCtrl = null;

const CATEGORY_META = {
  reception: { label: "Recepção / Triagem", icon: "fas fa-door-open", color: "#006494", bg: "rgba(0,100,148,0.10)" },
  service: { label: "Atendimento ao Cidadão", icon: "fas fa-handshake", color: "#0582ca", bg: "rgba(5,130,202,0.10)" },
  admin: { label: "Secretaria / Gestão", icon: "fas fa-building-columns", color: "#003554", bg: "rgba(0,53,84,0.10)" },
  vertical_circulation: { label: "Acesso / Circulação", icon: "fas fa-stairs", color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  facility: { label: "Apoio / Sanitários", icon: "fas fa-restroom", color: "#475569", bg: "rgba(71,85,105,0.10)" },
};

// Dicionário de Sinônimos Populares, Serviços e Termos do Cidadão
const ROOM_KEYWORDS = {
  "101": "iptu divida divida ativa debito parcelamento renegociacao cnd certidao negativa dividas acordo atrasado imposto",
  "102": "iss nota fiscal nfse abertura de empresa mei alvara autonomo prestador servicos taxas inscricao",
  "103": "fiscalizacao seplan alfredo lena loteamento vistoria notificacao postura terreno",
  "104": "receita federal pav cpf regularizar cpf imposto de renda vaf cnpj cadastro pessoa fisica pendencia",
  "105": "lanchonete cafe cantina comida almoço lanche suco agua cafezinho salgado",
  "106": "lanchonete funcionarios cozinha copa servidores",
  "107": "refeitorio cafe cantina servidores",
  "108": "obras alvara habite-se planta projeto reforma fiscalizacao de obras construcao calçada postura",
  "109": "arquivo rh recursos humanos servidores pasta funcional prontuario",
  "110": "iptu pagar iptu carne segunda via iptu isencao cadastro imobiliario transferencia itbi minas facil",
  "111": "recepcao entrada informacoes portaria triagem balcao onde fica ajuda senha fila",
  "112": "faxina limpeza dml material de limpeza",
  "113": "banheiro feminino sanitarios sanitário mulher wc toalete lavabo",
  "114": "banheiro masculino sanitarios sanitário homem wc toalete lavabo pcd acessibilidade cadeirante",
  "115": "saude secretaria de saude remedio medicamento farmacia exames consulta sus tratamento tfd",
  "116": "compras compras publicas cotacao fornecedores pedidos suprimentos licitacao",
  "117": "redacao licitacao edital pregao compras contratos",
  "118": "arquivo redacao licitacao contratos antigos",
  "119": "arquivo financas contabilidade balancetes empenhos",
  "120": "contabilidade financas empenho liquidacao orcamento balanco prestacao de contas",
  "121": "tesouraria financas pagamento fornecedor receita banco sefin",
  "122": "social sedeso financeiro compras social projetos",
  "123": "assistencia social sedeso bolsa familia cadunico cadastro unico cras creas auxilio conselho tutelar cesta basica vulnerabilidade",
  "124": "folha de pagamento salario holerite contracheque servidor consignado rh",
  "125": "recursos humanos rh administracao concurso posse atestado ferias sarh",
  "201": "vice-prefeita gabinete vice assessoria",
  "202": "secom comunicacao imprensa jornalismo noticias fotos",
  "203": "controle interno controladoria auditoria corregedoria fiscalizacao",
  "204": "ti informatica suporte computadores sistemas internet rede email tecnologia",
  "205": "compras saude hospital medicamentos insumos",
  "206": "atencao primaria saude bucal dentista odontologia ubs postos",
  "207": "faturamento sus faturamento saude bpa sia",
  "208": "tecnica estudio gravacao semap",
  "209": "obras fiscalizacao posturas 1 andar engenharia plantas",
  "210": "procuradoria advogados juridico parecer acoes judiciais defesa",
  "211": "banheiro feminino 1 andar sanitarios wc",
  "212": "banheiro masculino 1 andar sanitarios wc",
  "213": "procurador procuradoria geral parecer gabinete",
  "214": "secretaria de governo governo projetos executivo",
  "215": "administracao governo gabinete administracao",
  "216": "prefeito gabinete do prefeito reuniao prefeito executivo salao nobre",
  "217": "cozinha gabinete copa apoio",
  "218": "seplan planejamento urbano projetos engenharia arquitetura transito mobilidade",
  "219": "engenharia engenheiros seplan projetos plantas obras",
  "220": "meio ambiente defesa civil enchente deslizamento arvore poda queimada chuva emergencia animais",
  "221": "agricultura produtor rural zona rural estradas rurais sementes trator semmada",
  "222": "semap administracao apoio",
};

// Dicionário de Orientação Humana ("Como Chegar")
const ROOM_DIRECTIONS = {
  "101": "Térreo • No saguão principal de atendimento, logo à direita da entrada da Av. Brasil.",
  "102": "Térreo • No saguão de atendimento ao cidadão, guichês centrais.",
  "103": "Térreo • Corredor de fiscalização e planejamento urbano, ala térrea.",
  "104": "Térreo • Guichê de atendimento conveniado da Receita Federal (PAV).",
  "105": "Térreo • Ala de convivência e apoio ao público.",
  "106": "Térreo • Área interna de apoio aos servidores municipais.",
  "107": "Térreo • Área de cantina e refeitório interno.",
  "108": "Térreo • Setor de aprovação de projetos e fiscalização de obras particulares.",
  "109": "Térreo • Corredor de arquivos da Secretaria de Recursos Humanos.",
  "110": "Térreo • Balcão central de arrecadação do IPTU e cadastro imobiliário.",
  "111": "Térreo • Logo na entrada principal do prédio pela Av. Brasil.",
  "112": "Térreo • Área de apoio de serviços operacionais.",
  "113": "Térreo • Hall central de sanitários públicos.",
  "114": "Térreo • Hall central de sanitários e acessibilidade PCD.",
  "115": "Térreo • Setor de atendimento administrativo da Saúde no piso térreo.",
  "116": "Térreo • Ala de suprimentos e compras governamentais.",
  "117": "Térreo • Setor de redação de editais e processos de licitação.",
  "118": "Térreo • Acervo de processos e licitações.",
  "119": "Térreo • Arquivo contábil da Secretaria de Finanças.",
  "120": "Térreo • Setor de contabilidade e controle orçamentário.",
  "121": "Térreo • Gabinete da Secretaria de Finanças e Tesouraria.",
  "122": "Térreo • Ala administrativa da Secretaria de Desenvolvimento Social.",
  "123": "Térreo • Atendimento do Cadastro Único / Bolsa Família e assistência social.",
  "124": "Térreo • Setor de folha de pagamento da Secretaria de Recursos Humanos.",
  "125": "Térreo • Gabinete da Secretaria de Administração e Recursos Humanos.",
  "201": "1º Andar • Suba pelo elevador (114) ou escada (113) até a recepção do gabinete.",
  "202": "1º Andar • Próximo ao hall do 1º andar (Comunicação / SECOM).",
  "203": "1º Andar • Ala de controladoria e auditoria interna municipal.",
  "204": "1º Andar • Suba pelo elevador/escada, corredor norte à direita.",
  "205": "1º Andar • Ala administrativa da Secretaria Municipal da Saúde.",
  "206": "1º Andar • Coordenação de programas de saúde da família e bucal.",
  "207": "1º Andar • Setor de faturamento e processamento do SUS.",
  "208": "1º Andar • Corredor técnico do 1º pavimento.",
  "209": "1º Andar • Ala técnica da Secretaria de Obras e Planejamento.",
  "210": "1º Andar • Sala do corpo de advogados da Procuradoria Geral.",
  "211": "1º Andar • Sanitários femininos do 1º pavimento.",
  "212": "1º Andar • Sanitários masculinos do 1º pavimento.",
  "213": "1º Andar • Gabinete do Procurador Geral do Município.",
  "214": "1º Andar • Ala de governo e gestão executiva no 1º andar.",
  "215": "1º Andar • Gabinete e administração da Secretaria de Governo.",
  "216": "1º Andar • Gabinete Executivo do Prefeito Municipal.",
  "217": "1º Andar • Área de copa e apoio ao Gabinete do Prefeito.",
  "218": "1º Andar • Ala de engenharia e planejamento urbano (SEPLAN).",
  "219": "1º Andar • Recepção técnica de Engenheiros — SEPLAN.",
  "220": "1º Andar • Atendimento de Defesa Civil e Meio Ambiente.",
  "221": "1º Andar • Secretaria Municipal de Agricultura e Desenvolvimento Rural.",
  "222": "1º Andar • Sala técnica de apoio administrativo.",
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApp();
  } catch (err) {
    console.error("Erro ao inicializar aplicação:", err);
    alert(`Não foi possível carregar os dados da API: ${err.message}`);
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

  // Inicializa MapLibre no card discreto de apoio
  mapCtrl = new IndoorMapController({
    containerId: "map",
    center: [state.building.longitude, state.building.latitude],
    onRoomClick: (roomProps) => handleRoomSelect(Number(roomProps.id)),
  });

  await mapCtrl.init();

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
  await mapCtrl.loadFloor(state.activeFloorId);
  if (state.selectedRoom && state.selectedRoom.floor_id === state.activeFloorId) {
    mapCtrl.highlightRoom(state.selectedRoom.id);
  }
  mapCtrl.filterRooms(state.searchQuery);
  renderFloorSwitchers();
}

async function switchFloor(floorId) {
  await loadFloorOnMap(floorId);
}

function renderFloorSwitchers() {
  const container = document.getElementById("floorSwitcher");
  if (!container) return;
  container.innerHTML = "";

  for (const fl of state.floors) {
    const btn = document.createElement("button");
    btn.className = `floor-btn-mini ${fl.id === state.activeFloorId ? "active" : ""}`;
    btn.textContent = fl.name;
    btn.addEventListener("click", () => {
      switchFloor(fl.id);
    });
    container.appendChild(btn);
  }
}

function renderRoomFilterPills() {
  const container = document.getElementById("floorFilterPills");
  if (!container) return;
  container.innerHTML = "";

  const totalRooms = state.rooms.length;
  const allBtn = document.createElement("button");
  allBtn.className = `filter-pill ${state.roomFilterFloorId === "all" ? "active" : ""}`;
  allBtn.textContent = `Todos (${totalRooms})`;
  allBtn.addEventListener("click", () => {
    state.roomFilterFloorId = "all";
    renderRoomFilterPills();
    renderRoomsList();
  });
  container.appendChild(allBtn);

  for (const fl of state.floors) {
    const floorRoomsCount = state.rooms.filter((r) => r.floor_id === fl.id).length;
    const btn = document.createElement("button");
    btn.className = `filter-pill ${state.roomFilterFloorId === fl.id ? "active" : ""}`;
    btn.textContent = `${fl.name} (${floorRoomsCount})`;
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
  if (!listEl) return;
  listEl.innerHTML = "";

  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.rooms.filter((r) => {
    if (state.roomFilterFloorId !== "all" && r.floor_id !== state.roomFilterFloorId) {
      return false;
    }
    if (!q) return true;

    const keywords = ROOM_KEYWORDS[r.code] || "";
    const directions = ROOM_DIRECTIONS[r.code] || "";
    return (
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      keywords.includes(q) ||
      directions.toLowerCase().includes(q)
    );
  });

  const countBadge = document.getElementById("searchResultCount");
  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? "setor disponível" : "setores encontrados"}`;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="tc-card" style="text-align:center; padding: 48px 24px; color: #64748b;">
        <div style="font-size: 2.2rem; color: var(--azul-principal); margin-bottom: 12px;"><i class="fas fa-magnifying-glass"></i></div>
        <h3 style="color: var(--azul-escuro); margin-bottom: 6px;">Nenhum setor encontrado para "${state.searchQuery}"</h3>
        <p style="font-size: 0.9rem; color: #6c757d; margin-top: 6px;">Tente clicar em um dos atalhos acima como <strong>IPTU</strong>, <strong>Protocolo</strong>, <strong>Social</strong> ou <strong>Obras</strong>.</p>
      </div>
    `;
    return;
  }

  const highlight = (text) => {
    if (!q || !text) return text || "";
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return String(text).replace(regex, "<mark class='search-highlight'>$1</mark>");
  };

  for (const room of filtered) {
    const meta = CATEGORY_META[room.category] || CATEGORY_META.service;
    const isSelected = state.selectedRoom && state.selectedRoom.id === room.id;
    const directions = ROOM_DIRECTIONS[room.code] || `Fica no ${room.floor_name}.`;

    const card = document.createElement("div");
    card.className = `room-citizen-card ${isSelected ? "selected" : ""}`;

    card.innerHTML = `
      <div class="room-citizen-top">
        <span class="room-code-tag">
          ${highlight(room.code)}
        </span>
        <div class="room-meta-badges">
          <span class="room-category-pill" style="color:${meta.color}; background:${meta.bg};">
            <i class="${meta.icon}"></i> ${meta.label}
          </span>
          <span class="room-floor-pill">
            <i class="fas fa-layer-group" style="color:var(--azul-principal); margin-right:3px;"></i> ${room.floor_name}
          </span>
        </div>
      </div>

      <div class="room-title-area">
        <h3 class="room-citizen-name">${highlight(room.name)}</h3>
        <div class="room-citizen-dept">${highlight(room.department)}</div>
        ${room.description ? `<p class="room-citizen-desc">${highlight(room.description)}</p>` : ""}
      </div>

      <div class="room-citizen-bottom">
        <span class="room-citizen-hours"><i class="far fa-clock"></i> ${room.opening_hours || "08:00 às 17:00"}</span>
        <div class="room-card-actions">
          <button type="button" class="tc-btn tc-btn-primary tc-btn-sm btn-icon-only btn-card-map" data-map-btn="${room.id}" title="Ver no Mapa">
            <i class="fas fa-location-dot"></i>
          </button>
          <button type="button" class="tc-btn tc-btn-secondary tc-btn-sm btn-icon-only btn-card-qr" data-qr-btn="${room.id}" title="Abrir QR Code no Celular">
            <i class="fas fa-qrcode"></i>
          </button>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      // Se clicou no botão QR Code específico
      if (e.target.closest("[data-qr-btn]")) {
        e.stopPropagation();
        handleRoomSelect(room.id);
        updateQRModalLink();
        document.getElementById("qrModal").classList.remove("hidden");
        return;
      }
      handleRoomSelect(room.id);
    });

    listEl.appendChild(card);
  }

  mapCtrl?.filterRooms(state.searchQuery);
}

async function handleRoomSelect(roomId) {
  const room = state.rooms.find((r) => r.id === Number(roomId));
  if (!room) return;

  state.selectedRoom = room;

  if (state.activeFloorId !== room.floor_id) {
    await switchFloor(room.floor_id);
  }

  mapCtrl.highlightRoom(room.id);
  mapCtrl.focusRoom(room);
  renderRoomsList();
  updateMapCompanionFooter(room);

  // Rolagem suave no celular até o mapa para o cidadão ver imediatamente
  if (window.innerWidth <= 992) {
    document.getElementById("mapCardContainer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function updateMapCompanionFooter(room) {
  const container = document.getElementById("mapCompanionFooter");
  if (!container) return;

  if (!room) {
    container.innerHTML = `
      <div id="mapSelectedRoomInfo" class="map-room-info-empty">
        <i class="fas fa-hand-pointer" style="color: var(--azul-principal); font-size: 14px;"></i>
        <span>Clique em qualquer setor da lista para visualizar a localização no mapa.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="map-room-info-active">
      <div class="active-room-text">
        <span class="active-room-code-name"><i class="fas fa-location-dot" style="color:var(--azul-principal);"></i> ${room.code} — ${room.name}</span>
        <span class="active-room-dept-floor">${room.department} (${room.floor_name})</span>
      </div>
      <button type="button" id="btnActiveRoomQR" class="tc-btn tc-btn-secondary tc-btn-sm">
        <i class="fas fa-qrcode"></i> QR Code
      </button>
    </div>
  `;

  document.getElementById("btnActiveRoomQR")?.addEventListener("click", () => {
    updateQRModalLink();
    document.getElementById("qrModal").classList.remove("hidden");
  });
}

function bindUIEvents() {
  const searchInput = document.getElementById("searchInput");
  const btnClearSearch = document.getElementById("btnClearSearch");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      state.activeQuickFilter = null;
      updateQuickPillsVisual();

      if (btnClearSearch) {
        if (state.searchQuery.length > 0) {
          btnClearSearch.classList.remove("hidden");
        } else {
          btnClearSearch.classList.add("hidden");
        }
      }
      renderRoomsList();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      state.searchQuery = "";
      state.activeQuickFilter = null;
      updateQuickPillsVisual();
      btnClearSearch.classList.add("hidden");
      renderRoomsList();
    });
  }

  // Atalhos Rápidos por Serviço ("Mais Procurados")
  document.querySelectorAll(".quick-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-query");
      if (state.activeQuickFilter === q) {
        // Desativa se clicar novamente
        state.activeQuickFilter = null;
        state.searchQuery = "";
        if (searchInput) searchInput.value = "";
        btnClearSearch?.classList.add("hidden");
      } else {
        state.activeQuickFilter = q;
        state.searchQuery = q;
        if (searchInput) {
          searchInput.value = btn.textContent.trim().replace(/^[^\w]+/, "").trim();
        }
        btnClearSearch?.classList.remove("hidden");
      }
      updateQuickPillsVisual();
      renderRoomsList();
    });
  });

  const btn3D = document.getElementById("btnToggle3D");
  if (btn3D) {
    btn3D.addEventListener("click", () => {
      mapCtrl.resetView();
    });
  }

  const btnZoomIn = document.getElementById("btnZoomIn");
  if (btnZoomIn) {
    btnZoomIn.addEventListener("click", () => mapCtrl.zoomIn());
  }

  const btnZoomOut = document.getElementById("btnZoomOut");
  if (btnZoomOut) {
    btnZoomOut.addEventListener("click", () => mapCtrl.zoomOut());
  }

  const btnReset = document.getElementById("btnResetView");
  if (btnReset) {
    btnReset.addEventListener("click", () => mapCtrl.resetView());
  }

  // Modal QR Code Header Button
  const btnOpenQR = document.getElementById("btnOpenQRModal");
  if (btnOpenQR) {
    btnOpenQR.addEventListener("click", () => {
      updateQRModalLink();
      document.getElementById("qrModal").classList.remove("hidden");
    });
  }

  const btnCloseQR = document.getElementById("btnCloseQRModal");
  if (btnCloseQR) {
    btnCloseQR.addEventListener("click", () => {
      document.getElementById("qrModal").classList.add("hidden");
    });
  }
}

function updateQuickPillsVisual() {
  document.querySelectorAll(".quick-pill").forEach((btn) => {
    const q = btn.getAttribute("data-query");
    btn.classList.toggle("active", state.activeQuickFilter === q);
  });
}

function updateQRModalLink() {
  const roomId = state.selectedRoom ? state.selectedRoom.id : "";
  const shareUrl = roomId
    ? `${window.location.origin}/?room=${roomId}`
    : `${window.location.origin}/`;
  const urlInput = document.getElementById("qrUrlInput");
  if (urlInput) urlInput.value = shareUrl;

  const qrImg = document.getElementById("qrCodeImage");
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
  }
}

function checkURLParametersForQRCode() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room") || params.get("to_room");

  if (roomId) {
    handleRoomSelect(Number(roomId));
  }
}
