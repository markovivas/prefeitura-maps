/**
 * Gerenciador do Mapa MapLibre GL JS (Visão Externa OSM + Planta Indoor + Rotas).
 */
export class IndoorMapController {
  constructor({ containerId, center = [-45.26903, -21.67083], onRoomClick, onEnterIndoor }) {
    this.containerId = containerId;
    this.center = center;
    this.onRoomClick = onRoomClick;
    this.onEnterIndoor = onEnterIndoor;

    this.map = null;
    this.buildingMarker = null;
    this.isIndoorMode = true;
    this.currentFloorId = null;
    this.selectedRoomId = null;
  }

  async init() {
    this.map = new maplibregl.Map({
      container: this.containerId,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors | Prefeitura de Três Corações — MG",
          },
        },
        layers: [
          {
            id: "osm-Watch",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 22,
            paint: {
              "raster-opacity": 1.0,
            },
          },
        ],
      },
      center: this.center,
      zoom: 19.55,
      pitch: 20,
      bearing: 0,
      maxZoom: 22,
    });

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    this.map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

    return new Promise((resolve) => {
      this.map.on("load", () => {
        this._setupSourcesAndLayers();
        this._setupInteractions();
        resolve(this.map);
      });
    });
  }

  _setupSourcesAndLayers() {
    const emptyFC = { type: "FeatureCollection", features: [] };

    this.map.addSource("indoor-floor", { type: "geojson", data: emptyFC });
    this.map.addSource("indoor-floor-labels", { type: "geojson", data: emptyFC });

    // Salas preenchimento colorido por categoria (direto sobre o mapa)
    this.map.addLayer({
      id: "rooms-fill",
      type: "fill",
      source: "indoor-floor",
      filter: ["==", ["get", "layer_type"], "room"],
      paint: {
        "fill-color": [
          "match",
          ["get", "category"],
          "reception",
          "#a7f3d0",
          "service",
          "#bfdbfe",
          "admin",
          "#ddd6fe",
          "vertical_circulation",
          "#fde68a",
          "facility",
          "#cbd5e1",
          "#bfdbfe",
        ],
        "fill-opacity": [
          "case",
          ["==", ["get", "id"], -1],
          0.95,
          0.82,
        ],
      },
    });

    // Destaque da sala selecionada
    this.map.addLayer({
      id: "rooms-selected-highlight",
      type: "fill",
      source: "indoor-floor",
      filter: ["all", ["==", ["get", "layer_type"], "room"], ["==", ["get", "id"], -1]],
      paint: {
        "fill-color": "#3b82f6",
        "fill-opacity": 0.35,
      },
    });

    // Paredes / Bordas das salas
    this.map.addLayer({
      id: "rooms-border",
      type: "line",
      source: "indoor-floor",
      filter: ["==", ["get", "layer_type"], "room"],
      paint: {
        "line-color": [
          "match",
          ["get", "category"],
          "reception",
          "#059669",
          "service",
          "#2563eb",
          "admin",
          "#7c3aed",
          "vertical_circulation",
          "#d97706",
          "#475569",
        ],
        "line-width": 2.5,
      },
    });

    // Rótulos das salas em source separado (não bloqueia a geometria do polígono)
    this.map.addLayer({
      id: "rooms-label",
      type: "symbol",
      source: "indoor-floor-labels",
      filter: ["==", ["get", "layer_type"], "room_label"],
      layout: {
        "text-field": ["concat", ["get", "code"], "\n", ["get", "name"]],
        "text-font": ["Open Sans Semibold"],
        "text-size": 10.5,
        "text-anchor": "center",
        "text-max-width": 8,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });
  }

  _setupInteractions() {
    this.map.on("mouseenter", "rooms-fill", () => {
      this.map.getCanvas().style.cursor = "pointer";
    });

    this.map.on("mouseleave", "rooms-fill", () => {
      this.map.getCanvas().style.cursor = "";
    });

    this.map.on("click", "rooms-fill", (e) => {
      if (!e.features || !e.features.length) return;
      const props = e.features[0].properties;
      if (this.onRoomClick) {
        this.onRoomClick(props);
      }
    });
  }

  setBuildingMarker(building) {
    if (this.buildingMarker) {
      this.buildingMarker.remove();
    }

    const el = document.createElement("div");
    el.style.cssText = `
      background: #0f172a;
      color: #fff;
      padding: 8px 14px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 6px 20px rgba(15,23,42,0.35);
      border: 2px solid #3b82f6;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    `;
    el.innerHTML = `<span>📍 ${building.name}</span>`;
    el.title = "Clique para entrar no mapa interno";
    el.addEventListener("click", () => {
      if (this.onEnterIndoor) this.onEnterIndoor();
    });

    this.buildingMarker = new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([building.longitude, building.latitude])
      .addTo(this.map);

    if (this.isIndoorMode) {
      el.style.display = "none";
    }
  }

  enterIndoorView() {
    this.isIndoorMode = true;
    if (this.buildingMarker) {
      this.buildingMarker.getElement().style.display = "none";
    }
    this.map.flyTo({
      center: this.center,
      zoom: 19.55,
      pitch: 20,
      bearing: 0,
      duration: 900,
    });
  }

  exitToOutdoorView() {
    this.isIndoorMode = false;
    if (this.buildingMarker) {
      this.buildingMarker.getElement().style.display = "flex";
    }
    this.map.flyTo({
      center: this.center,
      zoom: 17.1,
      pitch: 0,
      bearing: 0,
      duration: 900,
    });
  }

  toggle3DPitch() {
    const currentPitch = this.map.getPitch();
    this.map.easeTo({
      pitch: currentPitch > 10 ? 0 : 45,
      duration: 500,
    });
  }

  setFloorGeoJSON(floorId, geojsonData) {
    this.currentFloorId = floorId;
    const allFeatures = (geojsonData && geojsonData.features) || [];
    const geomFeatures = allFeatures.filter(
      (f) => f.properties && f.properties.layer_type !== "room_label"
    );
    const labelFeatures = allFeatures.filter(
      (f) => f.properties && f.properties.layer_type === "room_label"
    );

    const src = this.map.getSource("indoor-floor");
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: geomFeatures,
      });
    }

    const labelSrc = this.map.getSource("indoor-floor-labels");
    if (labelSrc) {
      labelSrc.setData({
        type: "FeatureCollection",
        features: labelFeatures,
      });
    }
  }

  highlightRoom(roomId) {
    this.selectedRoomId = roomId || -1;
    if (this.map.getLayer("rooms-selected-highlight")) {
      this.map.setFilter("rooms-selected-highlight", [
        "all",
        ["==", ["get", "layer_type"], "room"],
        ["==", ["get", "id"], Number(this.selectedRoomId)],
      ]);
    }
  }

  focusRoom(room) {
    if (room && room.longitude && room.latitude) {
      this.map.easeTo({
        center: [Number(room.longitude), Number(room.latitude)],
        zoom: Math.max(this.map.getZoom(), 19.8),
        duration: 500,
      });
    }
  }
}
