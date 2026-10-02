import os
import sys
import math
import json
import ezdxf
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# Load GeoJSON rooms
with open('indoor/rooms/terreo_rooms.geojson', 'r', encoding='utf-8') as f:
    gj_f1 = json.load(f)

with open('indoor/rooms/andar_1_rooms.geojson', 'r', encoding='utf-8') as f:
    gj_f2 = json.load(f)

# Affine transformation matrix (WGS84 -> CAD Floor 1)
M_f1 = np.array([
    [39420.16940716949, 86150.5606608467],
    [-105119.25814107432, 43812.92853481724],
    [-492157.8434053697, 4854066.906100207]
])

# Read DXF
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

SCALE = 10.0
CANVAS_W = 780
CANVAS_H = 580

FLOOR_CONFIGS = [
    {
        "floor_id": 1,
        "name": "Térreo",
        "level": 0,
        "cad_x0": 1290.0,
        "cad_y_max": 4674.0,
        "x_range": (1290.0, 1368.0),
        "y_range": (4616.0, 4674.0),
        "rooms_gj": gj_f1,
        "is_floor_2": False,
        "output_svg": "frontend/assets/floorplans/floor_1.svg"
    },
    {
        "floor_id": 2,
        "name": "1º Andar",
        "level": 1,
        "cad_x0": 1426.0,
        "cad_y_max": 4674.0,
        "x_range": (1426.0, 1504.0),
        "y_range": (4616.0, 4674.0),
        "rooms_gj": gj_f2,
        "is_floor_2": True,
        "output_svg": "frontend/assets/floorplans/floor_2.svg"
    }
]

def cad_to_svg(x, y, x0, y_max):
    sx = (x - x0) * SCALE
    sy = (y_max - y) * SCALE
    return round(sx, 1), round(sy, 1)

def arc_to_svg_path(cx, cy, r, sa, ea, x0, y_max):
    d_theta = (ea - sa) % 360.0
    if d_theta <= 0:
        d_theta += 360.0
    steps = max(6, int(d_theta / 15.0))
    pts = []
    for i in range(steps + 1):
        ang_deg = sa + (d_theta * i / steps)
        ang_rad = math.radians(ang_deg)
        x = cx + r * math.cos(ang_rad)
        y = cy + r * math.sin(ang_rad)
        pts.append(cad_to_svg(x, y, x0, y_max))
    d = f"M {pts[0][0]} {pts[0][1]} " + " ".join(f"L {p[0]} {p[1]}" for p in pts[1:])
    return d

for cfg in FLOOR_CONFIGS:
    x0 = cfg["cad_x0"]
    y_max = cfg["cad_y_max"]
    xmin, xmax = cfg["x_range"]
    ymin, ymax = cfg["y_range"]
    
    wall_lines = []
    window_lines = []
    door_arcs = []
    column_circles = []
    other_lines = []
    cad_texts = []
    
    # Filter CAD entities
    for e in msp:
        etype = e.dxftype()
        layer = e.dxf.layer.upper()
        
        if etype == 'LINE':
            p1 = e.dxf.start
            p2 = e.dxf.end
            if xmin <= p1[0] <= xmax and ymin <= p1[1] <= ymax and xmin <= p2[0] <= xmax and ymin <= p2[1] <= ymax:
                sx1, sy1 = cad_to_svg(p1[0], p1[1], x0, y_max)
                sx2, sy2 = cad_to_svg(p2[0], p2[1], x0, y_max)
                
                if layer in ('0', '1', 'PAREDE'):
                    wall_lines.append((sx1, sy1, sx2, sy2))
                elif layer in ('.5', 'JANELAS', '0.1', 'AMARELO'):
                    window_lines.append((sx1, sy1, sx2, sy2))
                elif layer in ('0.8', 'PORTA', 'VÃO', 'VAO'):
                    door_arcs.append(f"M {sx1} {sy1} L {sx2} {sy2}")
                else:
                    other_lines.append((sx1, sy1, sx2, sy2))
                    
        elif etype in ('LWPOLYLINE', 'POLYLINE'):
            pts = list(e.get_points())
            if pts:
                p_in = [p for p in pts if xmin <= p[0] <= xmax and ymin <= p[1] <= ymax]
                if len(p_in) >= len(pts) * 0.7:
                    svg_pts = [cad_to_svg(p[0], p[1], x0, y_max) for p in pts]
                    pts_str = " ".join(f"{p[0]},{p[1]}" for p in svg_pts)
                    is_closed = getattr(e, 'is_closed', False)
                    if layer in ('0', '1', 'PAREDE', 'COLUNAS'):
                        wall_lines.append(pts_str if is_closed else ("poly", svg_pts))
                    else:
                        window_lines.append(pts_str if is_closed else ("poly", svg_pts))
                        
        elif etype == 'ARC':
            c = e.dxf.center
            if xmin <= c[0] <= xmax and ymin <= c[1] <= ymax:
                r = e.dxf.radius
                if 0.3 <= r <= 2.5:
                    p_str = arc_to_svg_path(c[0], c[1], r, e.dxf.start_angle, e.dxf.end_angle, x0, y_max)
                    door_arcs.append(p_str)
                    
        elif etype == 'CIRCLE':
            c = e.dxf.center
            if xmin <= c[0] <= xmax and ymin <= c[1] <= ymax:
                r = e.dxf.radius
                if 0.1 <= r <= 1.5:
                    scx, scy = cad_to_svg(c[0], c[1], x0, y_max)
                    column_circles.append((scx, scy, round(r * SCALE, 1)))

        elif etype in ('TEXT', 'MTEXT'):
            p = e.dxf.insert
            if xmin <= p[0] <= xmax and ymin <= p[1] <= ymax:
                text = getattr(e, 'text', getattr(e.dxf, 'text', '')).strip()
                if text and '/' in text and len(text) <= 8:
                    tx, ty = cad_to_svg(p[0], p[1], x0, y_max)
                    cad_texts.append((tx, ty, text.replace('\\P', ' ')))

    # Process Database Rooms
    svg_rooms = []
    for f in cfg["rooms_gj"]["features"]:
        props = f["properties"]
        room_id = props.get("id")
        code = props.get("code", "")
        name = props.get("name", "")
        dept = props.get("department", "")
        hours = props.get("opening_hours", "08:00 às 17:00")
        
        coords = np.array(f["geometry"]["coordinates"][0])
        w = np.column_stack([coords, np.ones(len(coords))])
        cad_pts = w @ M_f1
        if cfg["is_floor_2"]:
            cad_pts[:, 0] += 135.89
            
        svg_pts = [cad_to_svg(p[0], p[1], x0, y_max) for p in cad_pts]
        if svg_pts[0] == svg_pts[-1]:
            svg_pts = svg_pts[:-1]
            
        pts_str = " ".join(f"{p[0]},{p[1]}" for p in svg_pts)
        
        cx = round(sum(p[0] for p in svg_pts) / len(svg_pts), 1)
        cy = round(sum(p[1] for p in svg_pts) / len(svg_pts), 1)
        
        # Room short name for diagram (max 15 chars)
        short_name = name
        if len(short_name) > 15:
            short_name = short_name[:14] + "…"
            
        svg_rooms.append({
            "id": room_id,
            "code": code,
            "name": name,
            "department": dept,
            "hours": hours,
            "polygon_pts": pts_str,
            "cx": cx,
            "cy": cy,
            "short_name": short_name
        })
    
    # Generate SVG Content
    svg_lines = []
    svg_lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS_W} {CANVAS_H}" width="100%" height="100%" class="cad-blueprint-svg" data-floor-id="{cfg["floor_id"]}">')
    
    # Internal styles & definitions
    svg_lines.append('  <defs>')
    svg_lines.append('    <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">')
    svg_lines.append('      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0, 166, 251, 0.05)" stroke-width="0.7"/>')
    svg_lines.append('    </pattern>')
    svg_lines.append('    <pattern id="cadGridMajor" width="100" height="100" patternUnits="userSpaceOnUse">')
    svg_lines.append('      <rect width="100" height="100" fill="url(#cadGrid)"/>')
    svg_lines.append('      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(0, 166, 251, 0.12)" stroke-width="1.2"/>')
    svg_lines.append('    </pattern>')
    svg_lines.append('    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">')
    svg_lines.append('      <feGaussianBlur stdDeviation="3.5" result="blur"/>')
    svg_lines.append('      <feMerge>')
    svg_lines.append('        <feMergeNode in="blur"/>')
    svg_lines.append('        <feMergeNode in="SourceGraphic"/>')
    svg_lines.append('      </feMerge>')
    svg_lines.append('    </filter>')
    svg_lines.append('    <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">')
    svg_lines.append('      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#020817" flood-opacity="0.9"/>')
    svg_lines.append('    </filter>')
    svg_lines.append('  </defs>')
    
    # Blueprint Canvas Background
    svg_lines.append('  <!-- Blueprint Canvas Background -->')
    svg_lines.append(f'  <rect width="{CANVAS_W}" height="{CANVAS_H}" fill="#0a1128"/>')
    svg_lines.append(f'  <rect width="{CANVAS_W}" height="{CANVAS_H}" fill="url(#cadGridMajor)"/>')
    
    # Outer Building Frame Border (CAD Aesthetic)
    svg_lines.append(f'  <rect x="8" y="8" width="{CANVAS_W - 16}" height="{CANVAS_H - 16}" fill="none" stroke="rgba(0, 166, 251, 0.2)" stroke-width="1.2" stroke-dasharray="8 4"/>')
    svg_lines.append(f'  <text x="18" y="24" fill="#00a6fb" font-family="monospace" font-size="9" letter-spacing="1.5" opacity="0.75">PMTC • CENTRO ADMINISTRATIVO DR. ASTOLPHO GAZZOLA • {cfg["name"].upper()}</text>')

    # CAD Columns Layer
    svg_lines.append('  <!-- CAD Columns -->')
    svg_lines.append('  <g class="cad-columns" fill="#003554" stroke="#00a6fb" stroke-width="1.2">')
    for c in column_circles:
        svg_lines.append(f'    <circle cx="{c[0]}" cy="{c[1]}" r="{c[2]}"/>')
    svg_lines.append('  </g>')
    
    # CAD Windows & Openings Layer
    svg_lines.append('  <!-- CAD Windows & Openings -->')
    svg_lines.append('  <g class="cad-windows" stroke="#0582ca" stroke-opacity="0.5" stroke-width="0.9" fill="none">')
    for item in window_lines:
        if isinstance(item, tuple) and len(item) == 4:
            svg_lines.append(f'    <line x1="{item[0]}" y1="{item[1]}" x2="{item[2]}" y2="{item[3]}"/>')
        elif isinstance(item, str):
            svg_lines.append(f'    <polygon points="{item}"/>')
        elif isinstance(item, tuple) and item[0] == "poly":
            d_poly = " ".join(f"{p[0]},{p[1]}" for p in item[1])
            svg_lines.append(f'    <polyline points="{d_poly}"/>')
    svg_lines.append('  </g>')
    
    # CAD Doors & Swings Layer
    svg_lines.append('  <!-- CAD Doors & Swings -->')
    svg_lines.append('  <g class="cad-doors" stroke="#00a6fb" stroke-opacity="0.65" stroke-width="0.9" fill="none">')
    for p_d in door_arcs:
        svg_lines.append(f'    <path d="{p_d}"/>')
    svg_lines.append('  </g>')
    
    # CAD Walls Layer
    svg_lines.append('  <!-- CAD Architectural Walls -->')
    svg_lines.append('  <g class="cad-walls" stroke="#00a6fb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">')
    for item in wall_lines:
        if isinstance(item, tuple) and len(item) == 4:
            svg_lines.append(f'    <line x1="{item[0]}" y1="{item[1]}" x2="{item[2]}" y2="{item[3]}"/>')
        elif isinstance(item, str):
            svg_lines.append(f'    <polygon points="{item}" stroke="#38bdf8" stroke-width="2"/>')
        elif isinstance(item, tuple) and item[0] == "poly":
            d_poly = " ".join(f"{p[0]},{p[1]}" for p in item[1])
            svg_lines.append(f'    <polyline points="{d_poly}"/>')
    svg_lines.append('  </g>')

    # CAD Technical Dimensions
    svg_lines.append('  <!-- CAD Technical Annotations -->')
    svg_lines.append('  <g class="cad-dimensions" font-family="monospace" font-size="7" fill="#64748b" text-anchor="middle" opacity="0.4" pointer-events="none">')
    for dt in cad_texts:
        svg_lines.append(f'    <text x="{dt[0]}" y="{dt[1]}">{dt[2]}</text>')
    svg_lines.append('  </g>')

    # Interactive Database Rooms Overlay
    svg_lines.append('  <!-- Interactive Database Rooms Overlay -->')
    svg_lines.append('  <g class="cad-interactive-rooms">')
    for r in svg_rooms:
        r_id = r["id"]
        code = r["code"]
        r_name = r["name"].replace('"', '&quot;')
        r_dept = r["department"].replace('"', '&quot;')
        r_hours = r["hours"].replace('"', '&quot;')
        
        svg_lines.append(f'    <g class="svg-room" id="svg-room-{r_id}" data-room-id="{r_id}" data-room-code="{code}" data-floor-id="{cfg["floor_id"]}" data-name="{r_name}" data-dept="{r_dept}" data-hours="{r_hours}" tabindex="0" role="button" aria-label="Sala {code} - {r_name}">')
        svg_lines.append(f'      <polygon class="room-fill-poly" points="{r["polygon_pts"]}"/>')
        
        # Room badge group
        svg_lines.append(f'      <g class="room-badge-group" transform="translate({r["cx"]}, {r["cy"]})">')
        svg_lines.append(f'        <rect class="room-badge-bg" x="-14" y="-10" width="28" height="15" rx="3" filter="url(#badgeShadow)"/>')
        svg_lines.append(f'        <text class="room-badge-code" x="0" y="1" text-anchor="middle">{code}</text>')
        svg_lines.append(f'        <text class="room-badge-name" x="0" y="12" text-anchor="middle">{r["short_name"]}</text>')
        svg_lines.append('      </g>')
        svg_lines.append('    </g>')
    svg_lines.append('  </g>')
    
    svg_lines.append('</svg>')
    
    os.makedirs(os.path.dirname(cfg["output_svg"]), exist_ok=True)
    with open(cfg["output_svg"], "w", encoding="utf-8") as out_f:
        out_f.write("\n".join(svg_lines))
    print(f"Generated {cfg['output_svg']}: {len(wall_lines)} walls, {len(svg_rooms)} rooms.")

print("Floorplan SVGs built successfully!")
