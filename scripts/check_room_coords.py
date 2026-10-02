import json
import numpy as np

# Load geojson
with open('indoor/rooms/terreo_rooms.geojson', 'r', encoding='utf-8') as f:
    t_rooms = json.load(f)

print(f"Loaded {len(t_rooms['features'])} rooms from terreo_rooms.geojson")
for r in t_rooms['features']:
    props = r['properties']
    coords = r['geometry']['coordinates'][0]
    cx = sum(c[0] for c in coords) / len(coords)
    cy = sum(c[1] for c in coords) / len(coords)
    print(f"Room {props.get('code')}: ({cx:.7f}, {cy:.7f}) - {props.get('name')}")
