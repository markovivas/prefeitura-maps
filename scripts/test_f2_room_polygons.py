import json
import numpy as np

# Let's inspect Floor 2 rooms
# If Floor 1 uses M_f1, Floor 2 in CAD is shifted by dx = 135.89m
M_f1 = np.array([
    [39420.16940716949, 86150.5606608467],
    [-105119.25814107432, 43812.92853481724],
    [-492157.8434053697, 4854066.906100207]
])

# If Floor 2 has same WGS84 footprint as Floor 1, then in local building coords:
# Floor 2 cad_x = Floor 1 cad_x + 135.89 (relative to CAD model space)
# But in SVG, each floor can have its OWN SVG viewBox starting at 0, 0!

with open('indoor/rooms/andar_1_rooms.geojson', 'r', encoding='utf-8') as f:
    gj2 = json.load(f)

for f in gj2['features']:
    code = f['properties'].get('code')
    coords = np.array(f['geometry']['coordinates'][0])
    w = np.column_stack([coords, np.ones(len(coords))])
    cad_pts = w @ M_f1
    # If we shift by 135.89 for Floor 2 CAD space:
    cad_f2_pts = cad_pts.copy()
    cad_f2_pts[:, 0] += 135.89
    xs = cad_f2_pts[:, 0]
    ys = cad_f2_pts[:, 1]
    print(f"Floor 2 Room {code:3s}: CAD X=[{min(xs):.1f}, {max(xs):.1f}], Y=[{min(ys):.1f}, {max(ys):.1f}] - {f['properties'].get('name')}")
