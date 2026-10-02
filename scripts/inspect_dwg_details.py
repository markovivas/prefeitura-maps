import sys
import ezdxf

sys.stdout.reconfigure(encoding='utf-8')

doc = ezdxf.readfile('dwg/projeto.dxf')
msp = doc.modelspace()

print("=== INSPEÇÃO DETALHADA DO DWG ===")

# Vamos analisar os textos na área de cada pavimento
terreo_box = (1280.0, 1390.0, 4590.0, 4645.0)
superior_box = (1420.0, 1530.0, 4590.0, 4645.0)

def inspect_box(name, box):
    xmin, xmax, ymin, ymax = box
    print(f"\n--- {name} (X: [{xmin}, {xmax}], Y: [{ymin}, {ymax}]) ---")
    
    layers = {}
    texts = []
    
    for e in msp:
        # Pega ponto de referência da entidade
        p = None
        if hasattr(e, 'dxf'):
            if hasattr(e.dxf, 'start'):
                p = e.dxf.start
            elif hasattr(e.dxf, 'insert'):
                p = e.dxf.insert
        
        if p and xmin <= p[0] <= xmax and ymin <= p[1] <= ymax:
            layer = e.dxf.layer
            layers[layer] = layers.get(layer, 0) + 1
            
            if e.dxftype() in ('TEXT', 'MTEXT'):
                t = getattr(e.dxf, 'text', '')
                if hasattr(e, 'text'):
                    t = e.text
                if t.strip():
                    texts.append((t.strip().replace('\n', ' '), (round(p[0], 2), round(p[1], 2)), layer))
    
    print("Camadas encontradas:")
    for l, c in sorted(layers.items(), key=lambda x: -x[1]):
        print(f"  {l}: {c} entidades")
        
    print(f"\nTextos encontrados ({len(texts)}):")
    for t, pos, l in texts[:30]:
        print(f"  [{l}] {t} @ {pos}")

inspect_box("PAVIMENTO TÉRREO (INFERIOR)", terreo_box)
inspect_box("PAVIMENTO SUPERIOR (1º ANDAR)", superior_box)
