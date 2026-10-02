import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

# Floor 1 (Pav. Inferior) entities
f1_lines = []
for e in msp:
    if e.dxftype() == 'LINE':
        p1, p2 = e.dxf.start, e.dxf.end
        if 1280 <= p1[0] <= 1390 and 4610 <= p1[1] <= 4660:
            f1_lines.append((p1, p2, e.dxf.layer))

print(f"Floor 1 lines count: {len(f1_lines)}")
if f1_lines:
    x_all = [p[0] for line in f1_lines for p in line[:2]]
    y_all = [p[1] for line in f1_lines for p in line[:2]]
    print(f"Floor 1 bounds: X=[{min(x_all):.2f}, {max(x_all):.2f}] (width={max(x_all)-min(x_all):.2f}m), Y=[{min(y_all):.2f}, {max(y_all):.2f}] (height={max(y_all)-min(y_all):.2f}m)")

# Floor 2 (Pav. Superior) entities
f2_lines = []
for e in msp:
    if e.dxftype() == 'LINE':
        p1, p2 = e.dxf.start, e.dxf.end
        if 1420 <= p1[0] <= 1530 and 4610 <= p1[1] <= 4660:
            f2_lines.append((p1, p2, e.dxf.layer))

print(f"Floor 2 lines count: {len(f2_lines)}")
if f2_lines:
    x_all = [p[0] for line in f2_lines for p in line[:2]]
    y_all = [p[1] for line in f2_lines for p in line[:2]]
    print(f"Floor 2 bounds: X=[{min(x_all):.2f}, {max(x_all):.2f}] (width={max(x_all)-min(x_all):.2f}m), Y=[{min(y_all):.2f}, {max(y_all):.2f}] (height={max(y_all)-min(y_all):.2f}m)")

# Layers breakdown
for name, lines in [("Floor 1", f1_lines), ("Floor 2", f2_lines)]:
    layers = {}
    for _, _, layer in lines:
        layers[layer] = layers.get(layer, 0) + 1
    print(f"\n{name} Layers in bounding box:")
    for l, c in sorted(layers.items(), key=lambda x: -x[1]):
        print(f"  {l}: {c} lines")
