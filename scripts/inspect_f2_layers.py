import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

f2_entities = {}
for e in msp:
    p = None
    if hasattr(e, 'dxf'):
        if hasattr(e.dxf, 'start'):
            p = e.dxf.start
        elif hasattr(e.dxf, 'insert'):
            p = e.dxf.insert
        elif hasattr(e.dxf, 'center'):
            p = e.dxf.center
        elif e.dxftype() in ('LWPOLYLINE', 'POLYLINE'):
            pts = list(e.get_points())
            if pts:
                p = pts[0]

    if p and 1434 <= p[0] <= 1500 and 4618 <= p[1] <= 4652:
        layer = e.dxf.layer
        etype = e.dxftype()
        key = (layer, etype)
        f2_entities[key] = f2_entities.get(key, 0) + 1

print("Floor 2 Entities by (Layer, Type):")
for (layer, etype), count in sorted(f2_entities.items(), key=lambda x: -x[1]):
    print(f"  [{layer}] {etype}: {count}")
