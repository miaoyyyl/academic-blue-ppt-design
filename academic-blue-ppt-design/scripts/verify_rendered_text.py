"""Compare planned absolute pt sizes to actual PowerPoint text, including groups."""
from pathlib import Path
import argparse,json
ap=argparse.ArgumentParser();ap.add_argument('plan');ap.add_argument('bindings');ap.add_argument('render');ap.add_argument('report');args=ap.parse_args()
read=lambda f:json.loads(Path(f).read_text('utf-8-sig'))
plan=read(args.plan);bindings=read(args.bindings);render=read(args.render);checks=[]
node_types={'materials-two-input-merge','materials-circle-numbered-row','materials-outline-condition','materials-hexagon-explanation','human-left-label-band','human-square-notes','human-check-notes','human-dot-notes','materials-arrow-notes','human-arrow-outline-list','materials-diamond-notes'}
for b in bindings:
 if b.get('assetId') or b.get('text') is None:continue
 text=b['text'];text=''.join(map(str,text)) if isinstance(text,list) else str(text)
 if not text.strip():continue
 page=plan['pages'][b['page']-1];op=page['operations'][b['operation']];options=op.get('textOptions',{}).get(b['slot'],{})
 expected=options.get('font');actual=next((t for t in render[b['page']-1]['texts'] if t['name']==b['name']),None)
 present=actual is not None
 size_ok=present and (expected is None or abs(float(actual['fontPt'])-float(expected))<=0.15)
 min_ok=present and (op['typeId'] not in node_types or float(actual['fontPt'])>=17)
 fit_ok=present and actual['fits'] and actual['autoSize']==0
 checks.append({'page':b['page'],'name':b['name'],'typeId':op['typeId'],'slot':b['slot'],'expectedFontPt':expected,'actualFontPt':actual['fontPt'] if actual else None,'nestedGroup':bool(actual and actual.get('nestedGroup')),'absolutePtMatches':size_ok,'logicNodeAtLeast17Pt':min_ok,'fitsWithoutAutosize':fit_ok,'pass':size_ok and min_ok and fit_ok})
report={'pass':all(c['pass'] for c in checks),'scope':'actual PowerPoint pt sizes and fit, not inferred group-scale compensation','checkedTextSlots':len(checks),'checks':checks}
Path(args.report).parent.mkdir(parents=True,exist_ok=True);Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='checks'}));
if not report['pass']:
 print(json.dumps([c for c in checks if not c['pass']],ensure_ascii=False));raise SystemExit(2)
