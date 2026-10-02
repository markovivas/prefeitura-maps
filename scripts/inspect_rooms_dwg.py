import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')
doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

print("Entity types in modelspace:")
types = {}
for e in msp:
    types[e.dxftype()] = types.get(e.dxftype(), 0) + 1
for t, c in sorted(types.items(), key=lambda x: -x[1]):
    print(f"  {t}: {c}")

# Let's inspect all texts in Floor 1
print("\n--- All texts in Floor 1 (X: 1290-1375, Y: 4615-4655) ---")
f1_texts = []
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        p = e.dxf.insert
        if 1290 <= p[0] <= 1375 and 4615 <= p[1] <= 4655:
            text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
            clean = text.replace('\n', ' ').strip()
            if clean:
                f1_texts.append((clean, round(p[0], 2), round(p[1], 2), e.dxf.layer))

for t, x, y, layer in sorted(f1_texts, key=lambda item: (item[2], item[1])):
    print(f"({x}, {y}) [{layer}]: {t}")

print(f"\nTotal Floor 1 room texts: {len(f1_texts)}")

print("\n--- All texts in Floor 2 (X: 1425-1510, Y: 4615-4655) ---")
f2_texts = []
for e in msp:
    if e.dxftype() in ('TEXT', 'MTEXT'):
        p = e.dxf.insert
        if 1425 <= p[0] <= 1510 and 4615 <= p[1] <= 4655:
            text = e.text if hasattr(e, 'text') else getattr(e.dxf, 'text', '')
            clean = text.replace('\n', ' ').strip()
            if clean:
                f2_texts.append((clean, round(p[0], 2), round(p[1], 2), e.dxf.layer))

for t, x, y, layer in sorted(f2_texts, key=lambda item: (item[2], item[1])):
    print(f"({x}, {y}) [{layer}]: {t}")

print(f"\nTotal Floor 2 room texts: {len(f2_texts)}")
