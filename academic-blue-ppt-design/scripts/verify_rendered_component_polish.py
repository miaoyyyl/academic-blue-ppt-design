"""Check actual PowerPoint glyph bounds relative to the visible native node/label."""
from pathlib import Path
import argparse,json
from read_composition_evidence import inspect

p=argparse.ArgumentParser();p.add_argument('deck');p.add_argument('plan');p.add_argument('bindings');p.add_argument('rendered');p.add_argument('report');a=p.parse_args()
read=lambda f:json.loads(Path(f).read_text(encoding='utf-8-sig'))
actual=inspect(a.deck,a.plan,a.bindings)['plan'];rendered=read(a.rendered);bindings=read(a.bindings)
checks=[]
for pg,page in enumerate(actual['pages'],1):
    texts={t['name']:t for t in rendered[pg-1]['texts']}
    for ix,op in enumerate(page.get('operations',[])):
        if op['typeId']=='materials-two-input-merge':mapping={'input0':'107','input1':'109','result':'111'}
        elif op['typeId']=='materials-folded-tab':mapping={'heading':'23'}
        elif op['typeId']=='materials-compact-label':mapping={'label':'123'}
        elif op['typeId']=='materials-dashed-keyword':mapping={'label':'65'}
        elif op['typeId']=='materials-panel-heading':mapping={'heading':'63'}
        elif op['typeId']=='materials-outline-lead':mapping={'body':'12'}
        else:continue
        for slot,sid in mapping.items():
            binding=next(b for b in bindings if b['page']==pg and b['operation']==ix and b['slot']==slot)
            t=texts.get(binding['name']);b=op['_actualNativeBoxes'][sid]
            dx=dy=None
            if t:
                dx=(t['left']+t['width']/2)*4/3-b[0]-b[2]/2
                dy=(t['top']+t['height']/2)*4/3-b[1]-b[3]/2
            ok=t is not None and t['fits'] and abs(dx)<=4 and abs(dy)<=4
            checks.append({'page':pg,'name':binding['name'],'slot':slot,'glyphCenterDeltaPx':[round(dx,3),round(dy,3)] if t else None,'tolerancePx':4,'pass':ok})
report={'pass':all(c['pass'] for c in checks),'scope':'PowerPoint real glyph bounds against the visible blue label or node background; 1280x720 coordinates','checks':checks}
Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pass':report['pass'],'slots':len(checks),'failed':[c for c in checks if not c['pass']]}))
if not report['pass']:raise SystemExit(2)
