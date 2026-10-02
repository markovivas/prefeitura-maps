/**
 * IndoorMapController — Controlador da Planta Arquitetônica CAD Blueprint
 * Prefeitura Municipal de Três Corações
 * 
 * Substitui o mapa geográfico por Arte Fixa Técnica baseada no DWG original
 * (dwg/projeto.dwg), com as 47 salas cadastradas no PostGIS, pan/zoom e tooltips.
 */

import { SvgFloorplanViewer } from "./floorplan.js?v=10";

export class IndoorMapController extends SvgFloorplanViewer {
  constructor(options) {
    super(options);
  }
}

export { SvgFloorplanViewer };
