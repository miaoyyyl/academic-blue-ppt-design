/** Neutral recipe requests, registered pixel fixtures and bound native plans. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {compositionCatalog,compileComposition} from '../assets/composition-layout.mjs';
import {compositionExample} from '../assets/composition-examples.mjs';
import {applyNarrativePolicy} from '../assets/narrative-layout.mjs';
import {auditComposition} from '../assets/composition-policy.mjs';
const out=process.argv[2];if(!out)throw Error('Usage: make_composition_examples.mjs output-directory');
fs.mkdirSync(path.join(out,'input/assets'),{recursive:true});
const requests=['standard','capacity','optional'].flatMap(variant=>compositionCatalog.map(recipe=>({...compositionExample(recipe.id,variant),variant})));
const dimensions=Object.fromEntries(requests.flatMap(q=>q.figures.map(f=>[f.assetId,f.dimensions||[1200,650]])));
const py=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const code=`from PIL import Image,ImageDraw
from pathlib import Path
import hashlib,json,sys
r=Path(sys.argv[1]);assets=[]
for name,wh in json.loads(sys.argv[2]).items():
 im=Image.new('RGB',wh,'white');d=ImageDraw.Draw(im);w,h=wh
 for i in range(3):
  x=int(w*(.18+.32*i)) if w>h else w//2;y=h//2 if w>h else int(h*(.18+.32*i));rr=int(min(w,h)*.1)
  d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=['#124a8b','#3e83b6','#94bddc'][i],outline='#124a8b',width=3)
 f=r/'assets'/(name+'.png');im.save(f);assets.append({'asset_id':name,'kind':'generated-illustration','path':'assets/'+f.name,'dimensions':wh,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'generation_basis':'Neutral aspect and crop fixture; no scientific claim.'})
(r/'asset-manifest.json').write_text(json.dumps({'schema_version':1,'assets':assets},indent=2),'utf8')
`;
const pixel=spawnSync(py,['-c',code,path.resolve(out,'input'),JSON.stringify(dimensions)],{encoding:'utf8'});if(pixel.status)throw Error(pixel.stderr);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'input/asset-manifest.json'),'utf8')),assets=Object.fromEntries(manifest.assets.map(a=>[a.asset_id,a]));
const plan={schemaVersion:3,planningInterface:'WordDeckPlan-v4',figurePolicy:{version:1},implementation:'materials-native-clone',chapters:[{id:'neutral',title:'组合验证'}],pages:[]};
for(const q of requests){
 q.assets=assets;const c=compileComposition(q);if(!c.ok)throw Error(JSON.stringify({recipe:q.compositionId,variant:q.variant,errors:c.errors}));
 const recipe=compositionCatalog.find(r=>r.id===q.compositionId),title=recipe.name+' · '+({standard:'标准内容',capacity:'接近容量',optional:'可选变化'}[q.variant]);
 const header={id:q.pageId+'-frame',typeId:'materials-frame',bounds:[0,0,1280,77],fields:{title,number:'1'},textOptions:{title:{font:29,color:'FFFFFF',bold:true,box:[124,10,1100,57]},number:{font:22,color:'004BAD',bold:true,align:'ctr',vAlign:'ctr',box:[40,13,80,50]}}};
 const page={...c,compositionId:q.compositionId,relation:q.relation,compositionOptions:q.options,id:q.pageId,role:'content',chapterId:'neutral',subsectionId:recipe.id,title,sourceIds:[...new Set(q.groups.flatMap(g=>g.sourceIds))],modules:q.groups,compositionBounds:q.bounds||[44,177,1192,480],operations:[header,...c.operations],contentRouting:[{id:q.pageId+'-argument',sourceIds:q.groups[0].sourceIds,importance:'key',destination:'body',target:{operationId:header.id,slot:'title'},visibleText:title},...c.contentRouting],layoutFamily:recipe.id,compositionSeries:{id:recipe.id,reason:'同一通用组合的标准、容量与可选内容变化，用于验证结构保持与适配能力。',pageIds:['standard','capacity','optional'].map(v=>recipe.id+'-'+v),sourceIds:q.groups[0].sourceIds},notes:['中性技术验证素材，不是科研证据。']};
 plan.pages.push(page);
}
const compiled=applyNarrativePolicy(plan),audit=auditComposition(compiled);
// Sparse content is a review case, not a certified production deck. The unchanged
// build/finalize gates still reject these cases; retain the full report for inspection.
const blocking=audit.issues.filter(i=>i.code!=='LOCAL_REGION_CONTENT_TOO_SPARSE');if(blocking.length)throw Error(JSON.stringify(blocking));
for(const[name,value]of [['requests.json',requests],['deck-plan.json',compiled],['composition-audit.json',audit]])fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2));
console.log(JSON.stringify({recipes:compositionCatalog.length,pages:compiled.pages.length,allCasesCertified:audit.pass,contentReviews:audit.issues.length,output:path.resolve(out)}));
