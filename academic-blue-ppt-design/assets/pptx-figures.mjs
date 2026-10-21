import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {auditFigurePlan,imageDisplayGeometry,normalizeImageCrop} from './figure-policy.mjs';
export function auditPptxFigures({deck,plan,bindings,python}) {
  const p=typeof plan==='string'?JSON.parse(fs.readFileSync(plan,'utf8').replace(/^\uFEFF/,'')):plan;
  const base=auditFigurePlan(p);if(!base.pass)return base;
  const tool=fileURLToPath(new URL('../scripts/read_figure_evidence.py',import.meta.url));
  const r=spawnSync(python,[tool,path.resolve(deck),path.resolve(plan),path.resolve(bindings)],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'}});
  if(r.status!==0)throw Error('ACTUAL_FIGURE_EVIDENCE_FAILED: '+(r.stderr||r.stdout||r.error));
  const evidence=JSON.parse(r.stdout),issues=[...base.issues];
  for(const e of evidence) {
    const page=p.pages[e.page-1],op=page.operations[e.operation],f=(page.supportFigures||[]).find(f=>f.operationId===op.id);
    const add=code=>issues.push({code,pageId:page.id,operationId:op.id});
    if(e.error){add(e.error);continue;}
    const expected=imageDisplayGeometry({width:e.dimensions[0],height:e.dimensions[1],bounds:op.bounds,imageCrop:op.imageCrop,imageAlign:op.imageAlign});
    if(expected.actualBounds.some((v,i)=>Math.abs(v-e.actualBounds[i])>0.1))add('ACTUAL_IMAGE_DISPLAY_BOUNDS_CHANGED');
    if(normalizeImageCrop(op.imageCrop).some((v,i)=>Math.abs(v-e.imageCrop[i])>0.000011))add('ACTUAL_IMAGE_CROP_CHANGED');
    if(e.sourceAssetSha256&&e.mediaSha256!==e.sourceAssetSha256)add('ACTUAL_IMAGE_ASSET_CHANGED');
    if(base.planningInterface==='WordDeckPlan-v3'&&!e.sourceAssetSha256)add('ACTUAL_IMAGE_ASSET_HASH_REQUIRED');
    const [l,t,r,b]=e.imageCrop,[x,y,w,h]=e.actualBounds;
    e.figureType=f?.figureType;e.figureRole=f?.figureRole;e.readingTargets=(f?.readingTargets||[]).map(v=>({...v,displayBounds:[x+(v.rect[0]-l)/(1-l-r)*w,y+(v.rect[1]-t)/(1-t-b)*h,v.rect[2]/(1-l-r)*w,v.rect[3]/(1-t-b)*h]}));
  }
  return {...base,pass:!issues.length,issues,geometryChecked:true,visualReviewRequired:true,visualVerdict:'pending-separate-render-review',images:evidence};
}
