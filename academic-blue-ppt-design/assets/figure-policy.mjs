/** Image purpose and reversible source-window contract. Geometry is not a visual verdict. */
import {auditFigureFrames} from './figure-frame-policy.mjs';
export function normalizeImageCrop(crop = [0,0,0,0]) {
  if (!Array.isArray(crop) || crop.length !== 4 || crop.some(v=>!Number.isFinite(v)||v<0||v>=1) || crop[0]+crop[2]>=1 || crop[1]+crop[3]>=1)
    throw Error('IMAGE_CROP_INVALID: expected four finite removal ratios; opposite sums must be below one.');
  const result=crop.map(v=>Math.round(v*100000)/100000);
  if(result[0]+result[2]>=1||result[1]+result[3]>=1)throw Error('IMAGE_CROP_INVALID: source window vanishes at PPTX precision.');
  return result;
}
export function imageDisplayGeometry({width,height,bounds,imageCrop,imageAlign='center'}) {
  const c=normalizeImageCrop(imageCrop);
  if (![width,height].every(v=>Number.isFinite(v)&&v>0)||!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[2]<=0||bounds[3]<=0) throw Error('IMAGE_GEOMETRY_INVALID');
  if(!['center','left-top','right-top'].includes(imageAlign))throw Error('IMAGE_ALIGNMENT_INVALID');
  const sourceWindow=[c[0],c[1],1-c[0]-c[2],1-c[1]-c[3]];
  const w=width*sourceWindow[2],h=height*sourceWindow[3],s=Math.min(bounds[2]/w,bounds[3]/h);
  const x=imageAlign==='left-top'?bounds[0]:imageAlign==='right-top'?bounds[0]+bounds[2]-w*s:bounds[0]+(bounds[2]-w*s)/2;
  const y=imageAlign.endsWith('-top')?bounds[1]:bounds[1]+(bounds[3]-h*s)/2;
  return {imageCrop:c,sourceWindow,sourcePixelRect:[c[0]*width,c[1]*height,w,h],actualBounds:[x,y,w*s,h*s]};
}
const categories=new Set(['data','phenomenon','mechanism','scene','object','mixed']);
const roles=new Set(['primary-evidence','supporting-explanation','context']);
const destinations=new Set(['body','figure','speaker','source']);
const texts=o=>Object.values(o?.fields||{}).flat(Infinity).map(String).join('\n');
const within=(r,c)=>r.length===4&&r.every(Number.isFinite)&&r[2]>0&&r[3]>0&&r[0]>=c[0]-1e-5&&r[1]>=c[1]-1e-5&&r[0]+r[2]<=1-c[2]+1e-5&&r[1]+r[3]<=1-c[3]+1e-5;
export function auditFigurePlan(plan) {
  const issues=[],pages=[]; const modern=plan.planningInterface==='WordDeckPlan-v3'||Number(plan.figurePolicy?.version)>=1;
  for(const p of plan.pages||[]) {
    const ops=new Map((p.operations||[]).map(o=>[o.id,o]));
    const add=(code,details={})=>issues.push({code,pageId:p.id,...details});
    for(const [i,o] of (p.operations||[]).entries()) if(o.imageCrop!==undefined) {
      try {normalizeImageCrop(o.imageCrop);}catch(e){add('IMAGE_CROP_INVALID',{operation:i,message:e.message});}
      if(o.typeId!=='materials-paper-image')add('IMAGE_CROP_ON_NON_IMAGE',{operation:i});
    }
    if(!modern||p.role!=='content')continue;
    if(!p.thesis?.trim())add('VISIBLE_PAGE_ARGUMENT_REQUIRED');
    const moduleIds=new Set((p.modules||[]).map(m=>m.id)), figures=p.supportFigures||[],figureIds=new Set();
    for(const f of figures) {
      if(!f.id||figureIds.has(f.id))add('FIGURE_ID_INVALID',{figureId:f.id});figureIds.add(f.id);
      const op=ops.get(f.operationId);
      if(!op||op.typeId!=='materials-paper-image'||op.assetId!==f.assetId)add('FIGURE_OPERATION_BINDING_INVALID',{figureId:f.id});
      if(!categories.has(f.figureType)||!roles.has(f.figureRole))add('FIGURE_PURPOSE_REQUIRED',{figureId:f.id});
      if(f.sourceKind==='generated-illustration'&&f.figureRole==='primary-evidence')add('GENERATED_IMAGE_IS_NOT_EVIDENCE',{figureId:f.id});
      if(!Array.isArray(f.claimModuleIds)||!f.claimModuleIds.length||f.claimModuleIds.some(id=>!moduleIds.has(id)))add('FIGURE_CLAIM_BINDING_INVALID',{figureId:f.id});
      if(!['short','labels-only','none'].includes(f.captionPolicy))add('FIGURE_CAPTION_POLICY_REQUIRED',{figureId:f.id});
      if(f.captionOperationId&&!ops.has(f.captionOperationId))add('FIGURE_CAPTION_BINDING_INVALID',{figureId:f.id});
      let crop;try{crop=normalizeImageCrop(op?.imageCrop);}catch{continue;}
      if(!Array.isArray(f.readingTargets)||!f.readingTargets.length)add('FIGURE_READING_TARGETS_REQUIRED',{figureId:f.id});
      for(const t of f.readingTargets||[])if(!t.name||!['read','recognize'].includes(t.task)||!Array.isArray(t.rect)||!within(t.rect,crop))add('FIGURE_READING_TARGET_CROPPED_OR_INVALID',{figureId:f.id,target:t.name});
    }
    for(const o of p.operations||[])if(o.typeId==='materials-paper-image'&&!figures.some(f=>f.operationId===o.id&&f.assetId===o.assetId))add('UNPLANNED_CONTENT_IMAGE',{operationId:o.id});
    if(!Array.isArray(p.contentRouting)||!p.contentRouting.length)add('CONTENT_ROUTING_REQUIRED');
    const routeIds=new Set();
    for(const r of p.contentRouting||[]) {
      if(!r.id||routeIds.has(r.id)||!r.sourceIds?.length||!destinations.has(r.destination)||!['key','detail'].includes(r.importance))add('CONTENT_ROUTING_INVALID',{routeId:r.id});routeIds.add(r.id);
      if(r.importance==='key'&&!['body','figure'].includes(r.destination))add('KEY_CONTENT_MUST_BE_VISIBLE',{routeId:r.id});
      if(r.destination==='body') {
        const op=ops.get(r.target?.operationId); const value=op?.fields?.[r.target?.slot];
        if(value===undefined||!r.visibleText||!String(Array.isArray(value)?value.join('\n'):value).includes(r.visibleText))add('CONTENT_BODY_TARGET_INVALID',{routeId:r.id});
      }
      if(r.destination==='figure'&&!figureIds.has(r.target?.figureId))add('CONTENT_FIGURE_TARGET_INVALID',{routeId:r.id});
      if(r.destination==='speaker'&&(!r.notesText||!String(Array.isArray(p.notes)?p.notes.join('\n'):p.notes||'').includes(r.notesText)))add('CONTENT_SPEAKER_TARGET_INVALID',{routeId:r.id});
    }
    if(!p.visibleArgument||!Array.from(ops.values()).some(o=>texts(o).includes(p.visibleArgument)))add('PAGE_ARGUMENT_NOT_VISIBLE');
    pages.push({pageId:p.id,figures:figures.length,roles:figures.map(f=>f.figureRole),routing:(p.contentRouting||[]).reduce((a,r)=>(a[r.destination]=(a[r.destination]||0)+1,a),{})});
  }
  const frames=auditFigureFrames(plan);issues.push(...frames.issues);
  return {policyVersion:2,planningInterface:modern?'WordDeckPlan-v3':'legacy-compatible',pass:!issues.length,visualReviewRequired:modern,frames,issues,pages};
}
export function assertFigurePlan(plan) {const result=auditFigurePlan(plan);if(!result.pass)throw Error('FIGURE_PLAN_INVALID: '+JSON.stringify(result.issues));return result;}
export function assertFigureAssets(plan,manifest) {
  const assets=new Map((manifest.assets||[]).map(a=>[a.asset_id,a]));
  for(const page of plan.pages||[])for(const f of page.supportFigures||[]){
    // Earlier plans used figure references without operation IDs and purpose metadata.
    if(plan.planningInterface!=='WordDeckPlan-v3'&&!plan.figurePolicy?.version)continue;
    const a=assets.get(f.assetId);if(!a)throw Error('FIGURE_ASSET_UNREGISTERED: '+f.assetId);
    if(f.sourceKind&&a.kind!==f.sourceKind)throw Error('FIGURE_SOURCE_KIND_MISMATCH: '+f.assetId);
    if(a.figure_type&&a.figure_type!=='mixed'&&a.figure_type!==f.figureType)throw Error('FIGURE_REGISTERED_TYPE_MISMATCH: '+f.assetId);
    if(a.kind==='generated-illustration'&&f.figureRole==='primary-evidence')throw Error('GENERATED_IMAGE_IS_NOT_EVIDENCE: '+f.assetId);
  }
}
