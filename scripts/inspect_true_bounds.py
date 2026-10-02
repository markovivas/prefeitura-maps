import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

# Floor 1 building bounds
# Look at lines in X in [1292, 1366] and Y in [4618, 4673]
f1_layers = set()
f1_x, f1_y = [], []
for e in msp:
    if e.dxftype() == 'LINE':
        p1, p2 = e.dxf.start, e.dxf.end
        if 1292 <= p1[0] <= 1366 and 4618 <= p1[1] <= 4673 and 1292 <= p2[0] <= 1366 and 4618 <= p2[1] <= 4673:
            f1_layers.add(e.dxf.layer)
            f1_x.extend([p1[0], p2[0]])
            f1_y.extend([p1[1], p2[1]])

print("Floor 1 true bounds:")
print(f"  X: [{min(f1_x):.2f}, {max(f1_x):.2f}] (width: {max(f1_x)-min(f1_x):.2f}m)")
print(f"  Y: [{min(f1_y):.2f}, {max(f1_y):.2f}] (height: {max(f1_y)-min(f1_y):.2f}m)")
print(f"  Layers: {sorted(f1_layers)}")

# Floor 2 building bounds
# Look at lines in X in [1428, 1502] and Y in [4618, 4673]
f2_layers = set()
f2_x, f2_y = [], []
for e in msp:
    if e.dxftype() == 'LINE':
        p1, p2 = e.dxf.start, e.dxf.end
        if 1428 <= p1[0] <= 1502 and 4618 <= p1[1] <= 4673 and 1428 <= p2[0] <= 1502 and 4618 <= p2[1] <= 4673:
            f2_layers.add(e.dxf.layer)
            f2_x.extend([p1[0], p2[0]])
            f2_y.extend([p1[1], p2[1]])

print("\nFloor 2 true bounds:")
print(f"  X: [{min(f2_x):.2f}, {max(f2_x):.2f}] (width: {max(f2_x)-min(f2_x):.2f}m)")
print(f"  Y: [{min(f2_y):.2f}, {max(f2_y):.2f}] (height: {max(f2_y)-min(f2_y):.2f}m)")
print(f"  Layers: {sorted(f2_layers)}")
