"""Generate content-free, source-object-only component variants for PowerPoint QA."""
from pathlib import Path
import argparse,hashlib,json,shutil
ap=argparse.ArgumentParser();ap.add_argument('output');a=ap.parse_args();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
skill=Path(__file__).resolve().parents[1];bank=skill/'assets/native-components';types=json.loads((bank/'registry.json').read_text('utf-8'))
neutral='依据：说明对象甲的条件、作用及边界，关联证据乙，并保留适用范围。'
def content(n):return (neutral*((n//len(neutral))+1))[:n].rstrip('，、')+'。'
pages=[];examples=bank/'examples';examples.mkdir(exist_ok=True)
asset=sorted((bank/'assets').iterdir())[0];assets=out/'input/assets';assets.mkdir(parents=True,exist_ok=True);dest=assets/('neutral'+asset.suffix);shutil.copy2(asset,dest)
manifest={'schema_version':1,'source_word_sha256':None,'assets':[{'asset_id':'neutral-image','path':'assets/'+dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'kind':'neutral-template-decoration'}]}
(out/'input/asset-manifest.json').write_text(json.dumps(manifest,indent=2),'utf-8')
for t in types:
 for case in ['standard','capacity','optional']:
  stored=examples/(t['typeId']+'-'+case+'.json')
  if t.get('coordinateFixture') or t['typeId'] in ['materials-timeline-three','materials-circle-numbered-row','materials-outline-condition','materials-two-input-merge','materials-gradient-connector']:
   if not stored.exists():raise FileNotFoundError('REVIEWED_COMPONENT_FIXTURE_REQUIRED: '+str(stored))
   pages.append(json.loads(stored.read_text('utf-8-sig')));continue
  ty=t['typeId'];near=case=='capacity';optional=case=='optional';fields={};opts={};extra={};bounds=[70,190,520,340]
  for slot in t['slots']:
   if slot=='image':continue
   fields[slot]='中性示例'if slot!='body'else[''if optional else content(170 if near else 65)]
   opts[slot]={'font':17,'color':'162B40'}
  if ty=='materials-frame':
   bounds=[0,0,1280,77];fields={'title':'多条件约束下的方法比较与证据解释及适用范围分析'if near else'页面任务与关键判断','number':'01'};opts={'title':{'font':30,'color':'FFFFFF','bold':True,'box':[124,10,1100,57]},'number':{'font':23,'color':'004BAD','align':'ctr','box':[45,13,73,50]}}
  elif ty=='materials-cover':
   bounds=[0,0,1280,720];fields={'title':'中性研究主题\n条件、方法与证据的整合表达','subtitle':'示例材料 · 结构展示','meta':''if optional else'内容由调用方提供'};opts={'title':{'font':42,'color':'004BAD','bold':True,'align':'ctr','box':[75,185,1130,235]},'subtitle':{'font':19,'color':'004BAD','align':'ctr'},'meta':{'font':15,'color':'FFFFFF','align':'ctr'}};extra['objectBoxes']={'8':[0,0,1280,720],'60':[344.581,-344.581,590.838,1280]}
  elif ty in ['materials-badge-panel','materials-filled-column','materials-flow-step']:
   x,y,w,h=bounds;fields={'heading':'同层栏目甲','body':[''if optional else content(170 if near else 65)]};opts={'heading':{'font':20,'color':'FFFFFF','bold':True,'box':[x+12,y+4,w-24,38]},'body':{'font':17,'color':'162B40','box':[x+14,y+55,w-28,h-69]}}
   if ty=='materials-badge-panel':extra['objectBoxes']={'13':[x,y+14,w,h-14],'14':[x,y,240,42]};opts['heading']['box']=[x+12,y+4,216,36]
   elif ty=='materials-filled-column':extra['objectBoxes']={'14':bounds,'15':[x,y,w,46]}
   else:extra['objectBoxes']={'80':bounds,'81':[x,y,w,46]}
  elif ty=='materials-statement-band':
   bounds=[60,140,1160,100];fields={'body':''if optional else content(65 if near else 30)};opts={'body':{'font':22,'color':'004BAD','bold':True,'box':[74,149,1132,81]}}
  elif ty=='materials-text':
   bounds=[75,160,600,410];fields={'body':[''if optional else content(300 if near else 90)]};opts={'body':{'font':17,'color':'162B40','box':bounds}}
  elif ty=='materials-caption':
   bounds=[75,220,580,110];fields={'body':''if optional else content(140 if near else 45)};opts={'body':{'font':11.5,'color':'284461','box':bounds}}
  elif ty=='materials-side-label':
   bounds=[80,180,60,350];fields={'body':''if optional else('结构条件方法证据边界整合'if near else'整体思路')};opts={'body':{'font':20,'color':'FFFFFF'}}
  elif ty=='materials-flow-arrow':bounds=[100,260,120 if near else 55,80 if near else 55]
  elif ty=='materials-paper-image':
   bounds=[80,160,1100 if near else(450 if optional else 650),420 if optional else 350];extra['assetId']='neutral-image'
  op={'typeId':ty,'bounds':bounds,'fields':fields,'textOptions':opts,**extra};p={'id':ty+'-'+case,'role':'component-test','title':ty+' / '+case,'operations':[op],'notes':'中性组件检验；没有科学事实与用户身份。'};pages.append(p)
  (examples/(p['id']+'.json')).write_text(json.dumps(p,ensure_ascii=False,indent=2),'utf-8')
(out/'native-plan.json').write_text(json.dumps({'schemaVersion':2,'implementation':'materials-native-clone','pages':pages},ensure_ascii=False,indent=2),'utf-8');print(json.dumps({'pages':len(pages),'types':len(types),'examples':len(pages)}))
