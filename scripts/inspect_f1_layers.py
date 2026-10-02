import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

f1_entities = {}
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

    if p and 1298 <= p[0] <= 1364 and 4618 <= p[1] <= 4652:
        layer = e.dxf.layer
        etype = e.dxftype()
        key = (layer, etype)
        f1_entities[key] = f1_entities.get(key, 0) + 1

print("Floor 1 Entities by (Layer, Type):")
for (layer, etype), count in sorted(f1_entities.items(), key=lambda x: -x[1]):
    print(f"  [{layer}] {etype}: {count}")
