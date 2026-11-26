"""Turn GuitarSet JAMS annotations into one compact JSON file for the tracker evaluation.

Usage: python3 -I scripts/convert_guitarset.py <guitarset dir with ann/ and audio/> <dir>/notes.json

See docs/GUITAR.md for where to get GuitarSet and how to run the evaluation.
"""
import json, os, sys

root, out = sys.argv[1], sys.argv[2]
files = sorted(f for f in os.listdir(os.path.join(root, 'ann')) if f.endswith('.jams'))
result = {}
ranges = {i: [999, 0] for i in range(6)}
for name in files:
    d = json.load(open(os.path.join(root, 'ann', name)))
    notes = []
    for a in d['annotations']:
        if a['namespace'] != 'note_midi':
            continue
        src = int(a['annotation_metadata']['data_source'])
        for n in a['data']:
            midi = int(round(n['value']))
            ranges[src][0] = min(ranges[src][0], midi)
            ranges[src][1] = max(ranges[src][1], midi)
            # data_source 0 is the low E string, which guitarists call string 6.
            notes.append([round(n['time'], 4), midi, 6 - src, round(n['duration'], 4)])
    notes.sort()
    tempo = next((a['data'][0]['value'] for a in d['annotations'] if a['namespace'] == 'tempo'), None)
    result[name[:-5]] = {'notes': notes, 'tempo': tempo, 'kind': 'comp' if name.endswith('_comp.jams') else 'solo'}
json.dump(result, open(out, 'w'))
print(len(result), 'files; midi range by data_source:', ranges)
