/** Arrange copied native objects after measuring them; never resize fonts or pictures. */
import {textHeight} from './narrative-layout.mjs';
import {isPageClaim} from './page-lead.mjs';
import {alignPairedRegions,auditPairedRegions,attachRenderedGeometry} from './paired-layout.mjs';
export const DEFAULT_CONTENT_BOUNDS=[44,177,1192,480];
const fixed=new Set(['materials-frame','materials-cover','materials-navigation']);
const open=new Set(['materials-text','materials-arrow-notes','human-check-notes','human-square-notes','human-dot-notes','materials-diamond-notes']);
const panels=new Set(['materials-filled-column','materials-badge-panel','materials-flow-step','human-left-label-band']);
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
const flat=v=>(Array.isArray(v)?v.flat(Infinity):[v]).map(x=>String(x??''));
const textPresent=o=>Object.values(o.fields||{}).some(v=>flat(v).join('').trim());
const shift=(b,dx,dy)=>valid(b)?[b[0]+dx,b[1]+dy,b[2],b[3]]:b;
const round=n=>Math.round(n*1000)/1000;
export function unionBounds(boxes){
  const a=boxes.filter(valid);if(!a.length)return null;
  const x=Math.min(...a.map(b=>b[0])),y=Math.min(...a.map(b=>b[1]));
  return [x,y,Math.max(...a.map(b=>b[0]+b[2]))-x,Math.max(...a.map(b=>b[1]+b[3]))-y];
}
function bodyOperations(page){
  const captions=new Set((page.supportFigures||[]).map(f=>f.captionOperationId).filter(Boolean));
  return (page.operations||[]).filter(o=>{
    if(fixed.has(o.typeId))return false;
    if(o.typeId==='materials-caption')return captions.has(o.id);
    if(isPageClaim(o))return false;
    return textPresent(o)||(o.typeId==='materials-paper-image'&&o.assetId)||['materials-flow-arrow','materials-brace-group'].includes(o.typeId);
  });
}
function textNeed(o,slot,box){
  const opt=o.textOptions?.[slot]||{},paras=flat(o.fields?.[slot]);
  return textHeight(paras,Math.max(40,box[2]),opt.font||17,{leading:opt.leading||112,padding:4})+Math.max(0,paras.length-1)*(opt.paragraphAfter??5)+8;
}
function footprint(o,actual=false){
  if(actual&&valid(o._actualRenderedBounds))return o._actualRenderedBounds;
  if(open.has(o.typeId)){
    const boxes=Object.entries(o.fields||{}).filter(([,v])=>flat(v).join('').trim()).map(([s])=>{
      const b=(actual&&o._actualSlotBoxes?.[s])||o.textOptions?.[s]?.box||o.bounds;
      return valid(b)?[b[0],b[1],b[2],Math.min(b[3],textNeed(o,s,b))]:null;
    });
    return unionBounds(boxes)||o.bounds;
  }
  if(actual){
    if(valid(o._actualOperationBounds))return o._actualOperationBounds;
    const b=unionBounds([o._actualRegionBox,o._actualAnchorBox,...Object.values(o._actualSlotBoxes||{})]);if(b)return b;
  }
  return o.bounds;
}
export function measureSpatialPage(page,{actualEvidence=false,operationIds,availableBounds}={}){
  const region=availableBounds||page.compositionBounds||DEFAULT_CONTENT_BOUNDS;
  const ids=operationIds&&new Set(operationIds),ops=bodyOperations(page).filter(o=>!ids||ids.has(o.id));
  const b=unionBounds(ops.map(o=>footprint(o,actualEvidence)));
  if(!b)return {availableBounds:region,occupiedBounds:null,operations:0};
  const top=b[1]-region[1],bottom=region[1]+region[3]-b[1]-b[3],center=b[1]+b[3]/2-region[1]-region[3]/2;
  return {availableBounds:[...region],occupiedBounds:b.map(round),operations:ops.length,topFree:round(top),bottomFree:round(bottom),topFreeRatio:round(top/region[3]),bottomFreeRatio:round(bottom/region[3]),verticalSpanRatio:round(b[3]/region[3]),centerOffset:round(center),centerOffsetRatio:round(center/region[3])};
}
export function moveLayout(state,operationIds,dx,dy){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('SPATIAL_SHIFT_INVALID');
  const ids=new Set(operationIds);
  for(const o of state.operations||[])if(ids.has(o.id)){
    o.bounds=shift(o.bounds,dx,dy);
    for(const opt of Object.values(o.textOptions||{}))if(valid(opt.box))opt.box=shift(opt.box,dx,dy);
    for(const [id,box]of Object.entries(o.objectBoxes||{}))if(valid(box))o.objectBoxes[id]=shift(box,dx,dy);
    if(valid(o._actualOperationBounds))o._actualOperationBounds=shift(o._actualOperationBounds,dx,dy);
    if(valid(o._actualRenderedBounds))o._actualRenderedBounds=shift(o._actualRenderedBounds,dx,dy);
    for(const[slot,b]of Object.entries(o._renderedSlotBounds||{}))o._renderedSlotBounds[slot]=shift(b,dx,dy);
  }
  for(const g of state.contentGroups||[]){
    const members=[g.anchorId,...(g.memberIds||[]),...(g.imageMemberIds||[])].filter(Boolean);
    if(members.length&&members.every(id=>ids.has(id)))g.bounds=shift(g.bounds,dx,dy);
    else if(members.some(id=>ids.has(id)))g.bounds=unionBounds((state.operations||[]).filter(o=>members.includes(o.id)).map(o=>o.bounds))||g.bounds;
  }
  for(const b of state.bindings||state.compositionBindings||[])if(ids.has(b.operationId)||ids.has(b.captionOperationId)){
    for(const key of ['bounds','requestedBounds','displayBounds'])if(valid(b[key]))b[key]=shift(b[key],dx,dy);
  }
  for(const f of state.supportFigures||[])if(ids.has(f.operationId)){
    if(valid(f.requestedBounds))f.requestedBounds=shift(f.requestedBounds,dx,dy);
    if(valid(f.displayGeometry?.actualBounds))f.displayGeometry.actualBounds=shift(f.displayGeometry.actualBounds,dx,dy);
  }
  for(const r of state.contentRegions||[])if(r.operationIds?.every(id=>ids.has(id)))r.bounds=shift(r.bounds,dx,dy);
}
export function spatialGap(heights,available,baseGap=24,mode='auto'){
  if(!['auto','distribute'].includes(mode)||heights.length<2)return baseGap;
  const free=Math.max(0,available-heights.reduce((a,b)=>a+b,0)-baseGap*(heights.length-1));
  return Math.min(48,baseGap+free*.18/(heights.length-1));
}
function position(state,ids,region,mode){
  const p={role:'content',operations:state.operations,supportFigures:state.supportFigures,compositionBounds:region};
  const m=measureSpatialPage(p,{operationIds:ids});if(!m.occupiedBounds)return;
  const free=region[3]-m.occupiedBounds[3];if(free<-.1)return;
  const fraction=mode==='top'?0:mode==='auto'?.46:.5;
  const geometry=unionBounds(state.operations.filter(o=>ids.includes(o.id)).map(o=>o.bounds));
  const wanted=region[1]+Math.max(0,free)*fraction-m.occupiedBounds[1];
  const min=region[1]-geometry[1],max=region[1]+region[3]-geometry[1]-geometry[3];
  moveLayout(state,ids,0,Math.max(min,Math.min(max,wanted)));
}
export function balanceComposition(state,{compositionId,bounds=DEFAULT_CONTENT_BOUNDS,options={}}={}){
  const mode=options.verticalPlacement||'auto';
  if(!['auto','center','distribute','top'].includes(mode))throw Error('SPATIAL_PLACEMENT_INVALID');
  const all=state.operations.map(o=>o.id),imageIds=new Set(state.supportFigures.flatMap(f=>[f.operationId,f.captionOperationId,f.frameOperationId].filter(Boolean)));
  let lanes=[];
  if(state.pairedRegions?.length){alignPairedRegions(state,{move:moveLayout});lanes=[all];}
  else if(compositionId==='figure-with-explanations'||compositionId==='process-with-evidence'&&options.figurePosition==='right'||['context-and-notes','labeled-rows'].includes(compositionId)&&imageIds.size){
    lanes=[all.filter(id=>imageIds.has(id)),all.filter(id=>!imageIds.has(id))];
  }else if(compositionId==='evidence-and-details'){
    const cut=bounds[0]+(options.coreWidth??(bounds[2]-(options.gap??28))*.5)+(options.gap??28)/2;
    lanes=[state.operations.filter(o=>o.bounds[0]<cut).map(o=>o.id),state.operations.filter(o=>o.bounds[0]>=cut).map(o=>o.id)];
  }else lanes=[all];
  lanes=lanes.filter(a=>a.length);
  for(const ids of lanes)position(state,ids,bounds,mode);
  if(state.pairedRegions?.length)alignPairedRegions(state,{move:moveLayout});
  const measuredIds=new Set(bodyOperations({operations:state.operations,supportFigures:state.supportFigures}).map(o=>o.id));
  state.spatialLanes=lanes.length>1?lanes.map((ids,i)=>({id:'lane-'+i,operationIds:ids.filter(id=>measuredIds.has(id)),availableBounds:[...bounds]})):[];
  const metrics=measureSpatialPage({role:'content',operations:state.operations,supportFigures:state.supportFigures,compositionBounds:bounds});
  state.spatialLayout={version:1,placement:mode,basis:'measured native content groups; no font or picture resizing',...metrics};
  return state.spatialLayout;
}
export function applySpatialPlan(input){
  const plan=structuredClone(input);
  for(const p of plan.pages||[]){
    if(p.role!=='content'||p.spatialLayout?.version===1)continue;
    const ops=bodyOperations(p);let i=0;
    for(const o of p.operations||[])if(!o.id)o.id=p.id+'-spatial-'+i++;
    // Legacy open text boxes may reserve the entire remaining page. Only trim
    // transparent text frames; native panel and picture sizes remain unchanged.
    for(const o of ops)if(open.has(o.typeId))for(const [slot,opt]of Object.entries(o.textOptions||{})){
      if(valid(opt.box)&&o.fields?.[slot]){const h=Math.min(opt.box[3],textNeed(o,slot,opt.box)+12);opt.box=[...opt.box.slice(0,3),h];if(o.bounds?.[1]===opt.box[1])o.bounds=[...o.bounds.slice(0,3),Math.min(o.bounds[3],h)];}
    }
    const frameIds=new Set((p.supportFigures||[]).map(f=>f.frameOperationId));
    const state={operations:[...ops,...(p.operations||[]).filter(o=>frameIds.has(o.id))],contentGroups:p.contentGroups||[],bindings:p.compositionBindings||[],supportFigures:p.supportFigures||[],pairedRegions:p.pairedRegions||[]};
    balanceComposition(state,{bounds:p.compositionBounds||DEFAULT_CONTENT_BOUNDS,options:p.compositionOptions||{},compositionId:p.compositionId});
    p.spatialLayout=state.spatialLayout;p.spatialLanes=state.spatialLanes;
  }
  plan.spatialPolicy={version:1,bodyTextAlignment:'left-top',groupPlacement:'auto',actualGeometryRequired:true};
  return plan;
}
export function auditSpatialLayout(plan,{actualEvidence=false}={}){
  const issues=[],pages=[];
  for(const p of plan.pages||[]){
    if(p.role&&p.role!=='content')continue;
    const ops=bodyOperations(p);if(!ops.length)continue;
    const m=measureSpatialPage(p,{actualEvidence});
    const check=(metrics,lane)=>{
      if(!metrics.occupiedBounds)return;
      const add=code=>issues.push({code,pageId:p.id,...(lane?{lane}:{}),...metrics,message:'复核内容整体位置与空白分布，不能以空框、装饰或制作理由豁免。'});
      if(metrics.bottomFreeRatio>.35&&metrics.topFreeRatio<.12&&metrics.centerOffsetRatio<-.12)add('BODY_TOP_HEAVY');
      if(metrics.topFreeRatio>.35&&metrics.bottomFreeRatio<.12&&metrics.centerOffsetRatio>.12)add('BODY_BOTTOM_HEAVY');
    };
    check(m);
    const paired=auditPairedRegions(p,{actualEvidence});issues.push(...paired.issues);
    const lanes=[];
    for(const lane of p.spatialLanes||[]){
      const ids=lane.operationIds||[];
      if(!ids.length||ids.some(id=>!ops.some(o=>o.id===id))){issues.push({code:'SPATIAL_LANE_BINDING_INVALID',pageId:p.id,lane:lane.id});continue;}
      // The author cannot shrink a lane's available height to fake good balance.
      const lm=measureSpatialPage(p,{actualEvidence,operationIds:ids,availableBounds:m.availableBounds});check(lm,lane.id);lanes.push({id:lane.id,...lm});
      const hasPicture=ops.some(o=>ids.includes(o.id)&&o.typeId==='materials-paper-image');
      if(!hasPicture&&lm.verticalSpanRatio<.6)issues.push({code:'LOCAL_REGION_CONTENT_TOO_SPARSE',pageId:p.id,lane:lane.id,verticalSpanRatio:lm.verticalSpanRatio,message:'该文字或关系栏有大块空白；比较内含图证栏目或合页，单纯居中不解除。'});
    }
    if(m.availableBounds[3]<DEFAULT_CONTENT_BOUNDS[3]*.75){
      const full=measureSpatialPage(p,{actualEvidence,availableBounds:DEFAULT_CONTENT_BOUNDS});check(full,'physical-body-region');
    }
    for(const o of ops)if(panels.has(o.typeId)){
      const body=(actualEvidence&&o._actualSlotBoxes?.body)||o.textOptions?.body?.box;
      if(!valid(body)||!o.fields?.body)continue;
      const need=textNeed(o,'body',body),excess=body[3]-need,outer=footprint(o,actualEvidence);
      const matchedPeer=ops.some(other=>{
        if(other===o||!panels.has(other.typeId)||!other.fields?.body)return false;
        const ob=footprint(other,actualEvidence),tb=(actualEvidence&&other._actualSlotBoxes?.body)||other.textOptions?.body?.box;
        return valid(tb)&&Math.abs(ob[1]-outer[1])<3&&Math.abs(ob[3]-outer[3])<3&&tb[3]-textNeed(other,'body',tb)<=80;
      });
      if(excess>80&&excess>outer[3]*.45&&!matchedPeer)issues.push({code:'BODY_PANEL_EXCESSIVE_EMPTY_HEIGHT',pageId:p.id,operationId:o.id,emptyHeight:round(excess),panelHeight:round(outer[3])});
    }
    pages.push({pageId:p.id,...m,lanes,paired:paired.pairs});
  }
  return {policyVersion:1,pass:!issues.length,basis:actualEvidence?'actual native geometry; transparent text uses text bounds or conservative line estimates':'measured native groups; not allocation boxes',thresholds:{bottomFreeRatio:.35,topFreeRatio:.12,centerOffsetRatio:.12},issues,pages};
}
export function auditRenderedSpatial(plan,bindings,rendered){
  const attached=attachRenderedGeometry(plan,bindings,rendered),actual=attached.plan,issues=[...attached.issues];
  for(const [i,p]of actual.pages.entries()){
    const r=rendered.find(r=>r.page===i+1);if(!r){issues.push({code:'SPATIAL_RENDER_PAGE_MISSING',page:i+1});continue;}
    for(const [j,o]of (p.operations||[]).entries()){
      const parts=(r.objects||[]).filter(v=>v.name.startsWith('native.'+j+'.'));
      if(!parts.length&&bodyOperations(p).includes(o))issues.push({code:'SPATIAL_RENDER_OPERATION_MISSING',page:i+1,operationId:o.id});
      const toBox=v=>v.visualBounds?.length===4?v.visualBounds.map(n=>n*4/3):[v.left,v.top,v.width,v.height].map(n=>n*4/3);
      const b=unionBounds(parts.map(toBox));if(b)o._actualOperationBounds=b;
      const text=(r.texts||[]).filter(v=>parts.some(s=>s.name===v.name)&&v.text?.trim()&&[v.left,v.top,v.width,v.height].every(Number.isFinite));
      if(open.has(o.typeId)&&text.length)o._actualRenderedBounds=unionBounds(text.map(v=>[v.left,v.top,v.width,v.height].map(n=>n*4/3)));
    }
  }
  const a=auditSpatialLayout(actual,{actualEvidence:true});a.issues.unshift(...issues);a.pass=a.pass&&!issues.length;
  return a;
}
