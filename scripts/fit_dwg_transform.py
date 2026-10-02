import sys
import re
import json
import ezdxf
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# Read DXF
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

# Floor 1 text labels: find any text containing 3-digit room code like 101, 102, ... 125
cad_f1_rooms = {}
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
        p = e.dxf.insert
        if 1290 <= p[0] <= 1375 and 4615 <= p[1] <= 4655:
            # check for numbers 101-125
            m = re.findall(r'\b(1[0-2][0-9])\b', text)
            for code in m:
                cad_f1_rooms[code] = (p[0], p[1], text.strip())

# Floor 2 text labels: 201-225
cad_f2_rooms = {}
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
        p = e.dxf.insert
        if 1425 <= p[0] <= 1510 and 4615 <= p[1] <= 4655:
            m = re.findall(r'\b(2[0-2][0-9])\b', text)
            for code in m:
                cad_f2_rooms[code] = (p[0], p[1], text.strip())

print(f"CAD Floor 1 room codes found: {sorted(cad_f1_rooms.keys())}")
print(f"CAD Floor 2 room codes found: {sorted(cad_f2_rooms.keys())}")

# Load geojson
with open('indoor/rooms/terreo_rooms.geojson', 'r', encoding='utf-8') as f:
    gj_f1 = json.load(f)

with open('indoor/rooms/andar_1_rooms.geojson', 'r', encoding='utf-8') as f:
    gj_f2 = json.load(f)

# Collect points for Floor 1
pts_wgs = []
pts_cad = []
for f in gj_f1['features']:
    code = f['properties'].get('code')
    if code in cad_f1_rooms:
        coords = f['geometry']['coordinates'][0]
        cx = sum(c[0] for c in coords) / len(coords)
        cy = sum(c[1] for c in coords) / len(coords)
        pts_wgs.append([cx, cy, 1.0])
        cad_x, cad_y, _ = cad_f1_rooms[code]
        pts_cad.append([cad_x, cad_y])

print(f"\nFloor 1 matching pairs: {len(pts_cad)}")
for code in sorted(cad_f1_rooms.keys()):
    if code in [f['properties'].get('code') for f in gj_f1['features']]:
        print(f"  Code {code}: CAD=({cad_f1_rooms[code][0]:.2f}, {cad_f1_rooms[code][1]:.2f})")

# Let's fit affine transform: [cad_x, cad_y] = [lon, lat, 1] * M
if len(pts_wgs) >= 3:
    W = np.array(pts_wgs)
    C = np.array(pts_cad)
    # Solve W * M = C
    M, residuals, rank, s = np.linalg.lstsq(W, C, rcond=None)
    print("\nAffine transformation matrix M (WGS84 -> CAD Floor 1):")
    print(repr(M.tolist()))
    # Test residuals
    pred = W @ M
    err = np.sqrt(np.sum((pred - C)**2, axis=1))
    print(f"Residual errors (meters): mean={np.mean(err):.3f}m, max={np.max(err):.3f}m")
