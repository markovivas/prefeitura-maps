import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

print("Texts in Y: 4648 to 4675 in Floor 1:")
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        p = e.dxf.insert
        if 1290 <= p[0] <= 1375 and 4648 <= p[1] <= 4675:
            text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
            t = text.strip().replace('\n', ' ')
            print(f"  ({p[0]:.2f}, {p[1]:.2f}) [{e.dxf.layer}]: {t}")

print("\nTexts in Y: 4648 to 4675 in Floor 2:")
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        p = e.dxf.insert
        if 1425 <= p[0] <= 1510 and 4648 <= p[1] <= 4675:
            text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
            t = text.strip().replace('\n', ' ')
            print(f"  ({p[0]:.2f}, {p[1]:.2f}) [{e.dxf.layer}]: {t}")
