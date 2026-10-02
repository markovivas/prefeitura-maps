import json
import numpy as np

# Let's inspect the affine transformation
# Floor 1 CAD bounds:
# xmin = 1298.5, xmax = 1363.5, ymin = 4619.0, ymax = 4651.0
# Width = 65m, Height = 32m

# Load affine matrix from previous step
# M = [[39420.16940716949, 86150.5606608467], [-105119.25814107432, 43812.92853481724], [-492157.8434053697, 4854066.906100207]]

M_f1 = np.array([
    [39420.16940716949, 86150.5606608467],
    [-105119.25814107432, 43812.92853481724],
    [-492157.8434053697, 4854066.906100207]
])

with open('indoor/rooms/terreo_rooms.geojson', 'r', encoding='utf-8') as f:
    gj = json.load(f)

for f in gj['features']:
    code = f['properties'].get('code')
    coords = np.array(f['geometry']['coordinates'][0])
    w = np.column_stack([coords, np.ones(len(coords))])
    cad_pts = w @ M_f1
    xs = cad_pts[:, 0]
    ys = cad_pts[:, 1]
    print(f"Room {code:3s}: CAD X=[{min(xs):.1f}, {max(xs):.1f}], Y=[{min(ys):.1f}, {max(ys):.1f}] (dim: {max(xs)-min(xs):.1f}x{max(ys)-min(ys):.1f}m)")
