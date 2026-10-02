import math
import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

# Test arc parsing in ezdxf
# In DXF, ARC has dxf.center, dxf.radius, dxf.start_angle, dxf.end_angle (degrees, CCW)
arcs = [e for e in msp if e.dxftype() == 'ARC' and 1290 <= e.dxf.center[0] <= 1370]
print(f"Sample arcs in Floor 1: {len(arcs)}")
for a in arcs[:3]:
    c = a.dxf.center
    r = a.dxf.radius
    sa = a.dxf.start_angle
    ea = a.dxf.end_angle
    print(f"Arc at center=({c[0]:.2f}, {c[1]:.2f}), r={r:.2f}, angles=({sa:.1f}, {ea:.1f})")

# Test circle parsing
circles = [e for e in msp if e.dxftype() == 'CIRCLE' and 1290 <= e.dxf.center[0] <= 1370]
print(f"Sample circles in Floor 1: {len(circles)}")
for c in circles[:3]:
    print(f"Circle at center=({c.dxf.center[0]:.2f}, {c.dxf.center[1]:.2f}), r={c.dxf.radius:.2f}")

# Test polylines
lwpolys = [e for e in msp if e.dxftype() == 'LWPOLYLINE']
print(f"Sample LWPolylines in entire DXF: {len(lwpolys)}")
