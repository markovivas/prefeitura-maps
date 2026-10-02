import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')

doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

print(f"Total entities: {len(msp)}")

# Let's inspect where the main drawings are
# Find extents of entities
points = []
for e in msp:
    if e.dxftype() == 'LINE':
        points.append(e.dxf.start)
        points.append(e.dxf.end)
    elif e.dxftype() in ('LWPOLYLINE', 'POLYLINE'):
        for p in e.get_points():
            points.append(p[:2])
    elif e.dxftype() in ('TEXT', 'MTEXT'):
        points.append(e.dxf.insert)

xs = [p[0] for p in points]
ys = [p[1] for p in points]
print(f"Overall bounding box: X=[{min(xs):.2f}, {max(xs):.2f}], Y=[{min(ys):.2f}, {max(ys):.2f}]")

# Let's check text clusters or titles to see where floor 1 and floor 2 are
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
        text_clean = text.upper().replace('\n', ' ')
        if any(w in text_clean for w in ['PAVIMENTO', 'TERREO', 'TÉRREO', 'SUPERIOR', 'INFERIOR', 'PLANTA']):
            p = e.dxf.insert
            print(f"Title Text: '{text.strip()}' at ({p[0]:.2f}, {p[1]:.2f}) Layer: {e.dxf.layer}")
