/**
 * SvgFloorplanViewer — Visualizador Vetorial Arquitetônico Interativo
 * 
 * Desenvolvido para a Prefeitura Municipal de Três Corações.
 * Renderiza a planta executiva real (dwg/projeto.dwg) convertida em SVG com
 * suporte a Pan & Zoom fluido, seleção de salas, tooltips cad e sincronização.
 */

export class SvgFloorplanViewer {
  constructor({ containerId, onRoomClick, onFloorChange }) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.onRoomClick = onRoomClick;
    this.onFloorChange = onFloorChange;

    this.currentFloorId = 1;
    this.selectedRoomId = null;
    this.svgCache = new Map();
    this.currentSvg = null;
    this.tooltipEl = null;

    // ViewBox padrão
    this.baseW = 780;
    this.baseH = 580;
    this.viewBox = { x: 0, y: 0, w: this.baseW, h: this.baseH };

    // Estados de interação / Pan
    this.isDragging = false;
    this.startPointer = { x: 0, y: 0 };
    this.startViewBox = { ...this.viewBox };
    this.hasMoved = false;

    // Estados de toque (pinch-to-zoom)
    this.initialPinchDistance = null;
    this.initialPinchViewBox = null;
    this.animationFrameId = null;

    this._initTooltip();
  }

  _initTooltip() {
    let tt = document.getElementById("cadFloorplanTooltip");
    if (!tt) {
      tt = document.createElement("div");
      tt.id = "cadFloorplanTooltip";
      tt.className = "cad-floorplan-tooltip hidden";
      tt.innerHTML = `
        <div class="cad-tt-header">
          <span class="cad-tt-code">101</span>
          <span class="cad-tt-dept">Secretaria</span>
        </div>
        <div class="cad-tt-name">Nome do Setor</div>
        <div class="cad-tt-footer">
          <span class="cad-tt-hours"><i class="fas fa-clock"></i> 08:00 às 17:00</span>
          <span class="cad-tt-action"><i class="fas fa-hand-pointer"></i> Clique para ver</span>
        </div>
      `;
      // Anexa ao wrapper do mapa
      const wrapper = document.querySelector(".map-canvas-wrapper") || this.container.parentElement || document.body;
      wrapper.appendChild(tt);
    }
    this.tooltipEl = tt;
  }

  async init() {
    this.container.classList.add("cad-viewer-container");
    // Pré-carrega o Térreo por padrão
    await this.loadFloor(1);
    return this;
  }

  async loadFloor(floorId) {
    this.currentFloorId = Number(floorId);
    const svgPath = `/assets/floorplans/floor_${this.currentFloorId}.svg?v=1`;

    let svgText = this.svgCache.get(this.currentFloorId);
    if (!svgText) {
      try {
        const resp = await fetch(svgPath);
        if (!resp.ok) throw new Error(`Falha ao carregar planta: ${resp.status}`);
        svgText = await resp.text();
        this.svgCache.set(this.currentFloorId, svgText);
      } catch (err) {
        console.error("Erro ao carregar planta SVG:", err);
        return;
      }
    }

    // Injeta SVG diretamente no DOM
    this.container.innerHTML = svgText;
    this.currentSvg = this.container.querySelector("svg");
    if (!this.currentSvg) return;

    // Reseta viewBox ao padrão
    this.viewBox = { x: 0, y: 0, w: this.baseW, h: this.baseH };
    this._applyViewBox();

    // Liga eventos
    this._bindSvgInteractions();

    // Re-aplica seleção caso a sala atual pertença a este pavimento
    if (this.selectedRoomId) {
      this.highlightRoom(this.selectedRoomId);
    }

    if (this.onFloorChange) {
      this.onFloorChange(this.currentFloorId);
    }
  }

  _bindSvgInteractions() {
    if (!this.currentSvg) return;

    // Pan via Mouse Drag no fundo
    this.currentSvg.addEventListener("mousedown", (e) => this._onMouseDown(e));
    window.addEventListener("mousemove", (e) => this._onMouseMove(e));
    window.addEventListener("mouseup", () => this._onMouseUp());

    // Zoom via Scroll do Mouse
    this.currentSvg.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });

    // Touch events (Mobile drag + pinch zoom)
    this.currentSvg.addEventListener("touchstart", (e) => this._onTouchStart(e), { passive: false });
    this.currentSvg.addEventListener("touchmove", (e) => this._onTouchMove(e), { passive: false });
    this.currentSvg.addEventListener("touchend", () => this._onTouchEnd());

    // Interações nas salas interativas
    const roomGroups = this.currentSvg.querySelectorAll(".svg-room");
    roomGroups.forEach((group) => {
      group.addEventListener("click", (e) => {
        if (this.hasMoved) return; // Evita clique se foi um arrasto
        e.stopPropagation();
        const roomId = Number(group.dataset.roomId);
        const roomProps = {
          id: roomId,
          code: group.dataset.roomCode,
          name: group.dataset.name,
          department: group.dataset.dept,
          opening_hours: group.dataset.hours,
          floor_id: Number(group.dataset.floorId),
        };
        if (this.onRoomClick) {
          this.onRoomClick(roomProps);
        }
      });

      group.addEventListener("mouseenter", (e) => this._onRoomMouseEnter(e, group));
      group.addEventListener("mousemove", (e) => this._onRoomMouseMove(e));
      group.addEventListener("mouseleave", () => this._onRoomMouseLeave());
    });
  }

  _onMouseDown(e) {
    if (e.button !== 0) return; // Apenas botão esquerdo
    this.isDragging = true;
    this.hasMoved = false;
    this.startPointer = { x: e.clientX, y: e.clientY };
    this.startViewBox = { ...this.viewBox };
    this.container.classList.add("is-panning");
  }

  _onMouseMove(e) {
    if (!this.isDragging || !this.currentSvg) return;

    const dxPx = e.clientX - this.startPointer.x;
    const dyPx = e.clientY - this.startPointer.y;

    if (Math.abs(dxPx) > 3 || Math.abs(dyPx) > 3) {
      this.hasMoved = true;
      this._hideTooltip();
    }

    const rect = this.container.getBoundingClientRect();
    const scaleX = this.viewBox.w / rect.width;
    const scaleY = this.viewBox.h / rect.height;

    this.viewBox.x = this.startViewBox.x - dxPx * scaleX;
    this.viewBox.y = this.startViewBox.y - dyPx * scaleY;

    this._applyViewBox();
  }

  _onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.container.classList.remove("is-panning");
    }
  }

  _onWheel(e) {
    e.preventDefault();
    if (!this.currentSvg) return;

    const rect = this.container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Ponto no espaço do SVG sob o cursor
    const svgPointX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.w;
    const svgPointY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.h;

    // Fator de zoom
    const zoomFactor = e.deltaY < 0 ? 0.82 : 1.22;
    const newW = this.viewBox.w * zoomFactor;
    const newH = this.viewBox.h * zoomFactor;

    // Limites de zoom: min 140px (zoom alto), max 1400px (visão ampla)
    if (newW < 140 || newW > 1400) return;

    this.viewBox.w = newW;
    this.viewBox.h = newH;
    this.viewBox.x = svgPointX - (mouseX / rect.width) * newW;
    this.viewBox.y = svgPointY - (mouseY / rect.height) * newH;

    this._applyViewBox();
    this._hideTooltip();
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.hasMoved = false;
      this.startPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.startViewBox = { ...this.viewBox };
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      this.initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      this.initialPinchViewBox = { ...this.viewBox };
    }
  }

  _onTouchMove(e) {
    if (!this.currentSvg) return;
    if (e.touches.length === 1 && this.isDragging) {
      const dxPx = e.touches[0].clientX - this.startPointer.x;
      const dyPx = e.touches[0].clientY - this.startPointer.y;
      if (Math.abs(dxPx) > 4 || Math.abs(dyPx) > 4) {
        this.hasMoved = true;
      }
      const rect = this.container.getBoundingClientRect();
      const scaleX = this.viewBox.w / rect.width;
      const scaleY = this.viewBox.h / rect.height;

      this.viewBox.x = this.startViewBox.x - dxPx * scaleX;
      this.viewBox.y = this.startViewBox.y - dyPx * scaleY;
      this._applyViewBox();
      e.preventDefault();
    } else if (e.touches.length === 2 && this.initialPinchDistance) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = this.initialPinchDistance / currentDist;
      const newW = this.initialPinchViewBox.w * ratio;
      const newH = this.initialPinchViewBox.h * ratio;

      if (newW >= 140 && newW <= 1400) {
        const rect = this.container.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const svgPointX = this.initialPinchViewBox.x + (midX / rect.width) * this.initialPinchViewBox.w;
        const svgPointY = this.initialPinchViewBox.y + (midY / rect.height) * this.initialPinchViewBox.h;

        this.viewBox.w = newW;
        this.viewBox.h = newH;
        this.viewBox.x = svgPointX - (midX / rect.width) * newW;
        this.viewBox.y = svgPointY - (midY / rect.height) * newH;
        this._applyViewBox();
      }
      e.preventDefault();
    }
  }

  _onTouchEnd() {
    this.isDragging = false;
    this.initialPinchDistance = null;
    this.initialPinchViewBox = null;
  }

  _onRoomMouseEnter(e, group) {
    if (this.isDragging) return;
    this._showTooltip(e, group);
  }

  _onRoomMouseMove(e) {
    if (this.tooltipEl && !this.tooltipEl.classList.contains("hidden")) {
      this._positionTooltip(e);
    }
  }

  _onRoomMouseLeave() {
    this._hideTooltip();
  }

  _showTooltip(e, group) {
    if (!this.tooltipEl) return;
    const code = group.dataset.roomCode || "";
    const name = group.dataset.name || "";
    const dept = group.dataset.dept || "";
    const hours = group.dataset.hours || "08:00 às 17:00";

    this.tooltipEl.querySelector(".cad-tt-code").textContent = `Sala ${code}`;
    this.tooltipEl.querySelector(".cad-tt-dept").textContent = dept;
    this.tooltipEl.querySelector(".cad-tt-name").textContent = name;
    this.tooltipEl.querySelector(".cad-tt-hours").innerHTML = `<i class="fas fa-clock"></i> ${hours}`;

    this._positionTooltip(e);
    this.tooltipEl.classList.remove("hidden");
  }

  _positionTooltip(e) {
    if (!this.tooltipEl) return;
    const wrapper = this.container.parentElement || document.body;
    const wrapperRect = wrapper.getBoundingClientRect();

    let x = e.clientX - wrapperRect.left + 15;
    let y = e.clientY - wrapperRect.top + 15;

    const ttWidth = 240;
    const ttHeight = 110;

    if (x + ttWidth > wrapperRect.width - 10) {
      x = e.clientX - wrapperRect.left - ttWidth - 15;
    }
    if (y + ttHeight > wrapperRect.height - 10) {
      y = e.clientY - wrapperRect.top - ttHeight - 15;
    }

    this.tooltipEl.style.transform = `translate(${Math.max(10, x)}px, ${Math.max(10, y)}px)`;
  }

  _hideTooltip() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.add("hidden");
    }
  }

  _applyViewBox() {
    if (!this.currentSvg) return;
    this.currentSvg.setAttribute(
      "viewBox",
      `${this.viewBox.x.toFixed(1)} ${this.viewBox.y.toFixed(1)} ${this.viewBox.w.toFixed(1)} ${this.viewBox.h.toFixed(1)}`
    );
  }

  zoomIn() {
    const centerPointX = this.viewBox.x + this.viewBox.w / 2;
    const centerPointY = this.viewBox.y + this.viewBox.h / 2;
    const factor = 0.75;
    const newW = Math.max(140, this.viewBox.w * factor);
    const newH = Math.max(100, this.viewBox.h * factor);

    this.animateToViewBox({
      x: centerPointX - newW / 2,
      y: centerPointY - newH / 2,
      w: newW,
      h: newH,
    });
  }

  zoomOut() {
    const centerPointX = this.viewBox.x + this.viewBox.w / 2;
    const centerPointY = this.viewBox.y + this.viewBox.h / 2;
    const factor = 1.35;
    const newW = Math.min(1300, this.viewBox.w * factor);
    const newH = Math.min(970, this.viewBox.h * factor);

    this.animateToViewBox({
      x: centerPointX - newW / 2,
      y: centerPointY - newH / 2,
      w: newW,
      h: newH,
    });
  }

  resetView() {
    this.animateToViewBox({
      x: 0,
      y: 0,
      w: this.baseW,
      h: this.baseH,
    });
  }

  animateToViewBox(target, duration = 300) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    const start = { ...this.viewBox };
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.viewBox.x = start.x + (target.x - start.x) * ease;
      this.viewBox.y = start.y + (target.y - start.y) * ease;
      this.viewBox.w = start.w + (target.w - start.w) * ease;
      this.viewBox.h = start.h + (target.h - start.h) * ease;

      this._applyViewBox();

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(step);
      }
    };
    this.animationFrameId = requestAnimationFrame(step);
  }

  highlightRoom(roomId) {
    this.selectedRoomId = Number(roomId);
    if (!this.currentSvg) return;

    // Remove destaque anterior
    const prev = this.currentSvg.querySelectorAll(".svg-room.is-selected");
    prev.forEach((el) => el.classList.remove("is-selected"));

    // Adiciona destaque na sala
    const target = this.currentSvg.querySelector(`#svg-room-${this.selectedRoomId}`);
    if (target) {
      target.classList.add("is-selected");
    }
  }

  focusRoom(room) {
    if (!room || !this.currentSvg) return;
    const target = this.currentSvg.querySelector(`#svg-room-${room.id}`);
    if (!target) return;

    const poly = target.querySelector("polygon");
    if (!poly) return;

    try {
      const bbox = poly.getBBox();
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      // Zoom confortável na sala
      const targetW = 280;
      const targetH = targetW * (this.baseH / this.baseW);

      this.animateToViewBox({
        x: cx - targetW / 2,
        y: cy - targetH / 2,
        w: targetW,
        h: targetH,
      });
    } catch (e) {
      // Fallback se getBBox falhar
    }
  }

  filterRooms(searchQuery) {
    if (!this.currentSvg) return;
    const q = (searchQuery || "").trim().toLowerCase();
    const rooms = this.currentSvg.querySelectorAll(".svg-room");

    if (!q) {
      rooms.forEach((r) => r.classList.remove("is-dimmed"));
      return;
    }

    rooms.forEach((r) => {
      const code = (r.dataset.roomCode || "").toLowerCase();
      const name = (r.dataset.name || "").toLowerCase();
      const dept = (r.dataset.dept || "").toLowerCase();
      const match = code.includes(q) || name.includes(q) || dept.includes(q);

      if (match) {
        r.classList.remove("is-dimmed");
      } else {
        r.classList.add("is-dimmed");
      }
    });
  }

  // Compatibilidade com app.js
  setFloorGeoJSON(floorId) {
    if (Number(floorId) !== this.currentFloorId) {
      this.loadFloor(floorId);
    }
  }

  toggle3DPitch() {
    this.resetView();
  }
}
