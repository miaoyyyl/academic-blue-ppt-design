/** Region ownership is verified from member objects, never from a passed flag. */
import {textHeight} from './narrative-layout.mjs';
import {attachedHeadingFits} from './component-polish.mjs';
export const REGION_FRAME='materials-mixed-region-frame';
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
export const containsRegion=(a,b,t=2)=>valid(a)&&valid(b)&&b[0]>=a[0]-t&&b[1]>=a[1]-t&&b[0]+b[2]<=a[0]+a[2]+t&&b[1]+b[3]<=a[1]+a[3]+t;
export function unionRegion(bs){bs=bs.filter(valid);if(!bs.length)return null;const x=Math.min(...bs.map(b=>b[0])),y=Math.min(...bs.map(b=>b[1]));return[x,y,Math.max(...bs.map(b=>b[0]+b[2]))-x,Math.max(...bs.map(b=>b[1]+b[3]))-y];}
const fields=o=>o._actualFields||o.fields||{};
const text=o=>Object.values(fields(o)).flat(Infinity).join('').trim();
const opBox=(o,actual)=>actual?o._actualOperationBounds||o.bounds:o.bounds;
const frameTypes=new Set([REGION_FRAME,'human-figure-frame-solid','materials-figure-frame-dashed']);
export function auditRegions(plan,{actualEvidence=false}={}){
 const issues=[],pages=[];
 for(const p of plan.pages||[]){
  if(p.role!=='content')continue;
  const regions=(p.contentRegions||[]).filter(r=>r.kind==='mixed-region');
  const ops=p.operations||[],byOp=new Map(ops.map(o=>[o.id,o])),byRegion=new Map(regions.map(r=>[r.id,r]));
  const add=(code,d={})=>issues.push({code,pageId:p.id,...d});
  if((p.regions?.length||ops.some(o=>o.typeId===REGION_FRAME))&&!regions.length)add('REGION_PLAN_NOT_COMPILED');
  if(regions.length!==byRegion.size)add('REGION_DUPLICATE_ID');
  const bodyOwners=new Map();
  for(const r of regions){
   const frame=byOp.get(r.frameOperationId),header=byOp.get(r.headingOperationId);
   if(!r.id||!r.purpose?.trim()||!valid(r.bounds)||!frame||frame.typeId!==REGION_FRAME||!header||!text(header))add('REGION_CONTAINER_INVALID',{regionId:r.id});
   const all=r.operationIds||[],members=all.map(id=>byOp.get(id));
   if(new Set(all).size!==all.length||all.some(id=>!byOp.has(id))||!all.includes(r.frameOperationId)||!all.includes(r.headingOperationId))add('REGION_MEMBER_BINDING_INVALID',{regionId:r.id});
   const meaningful=members.filter(o=>o&&!frameTypes.has(o.typeId)&&o.id!==r.headingOperationId&&o.typeId!=='materials-caption'&&o.semanticRole!=='lane-label'&&(text(o)||o.typeId==='materials-paper-image'||o.relationEdge));
   if(!meaningful.length)add('REGION_EMPTY_CONTAINER',{regionId:r.id});
   if(frame?.regionContainer?.regionId!==r.id||frame?.regionContainer?.purpose!==r.purpose)add('REGION_FRAME_METADATA_INVALID',{regionId:r.id});
    for(const o of members.filter(Boolean))if(!containsRegion(r.bounds,opBox(o,actualEvidence),4)&&!attachedHeadingFits(o,r,frame,actualEvidence))add('REGION_MEMBER_OUTSIDE',{regionId:r.id,operationId:o.id,bounds:opBox(o,actualEvidence),region:r.bounds});
   if(r.parentId){
    const parent=byRegion.get(r.parentId);
    if(!parent||!parent.childIds?.includes(r.id)||!containsRegion(parent.bounds,r.bounds))add('REGION_PARENT_BINDING_INVALID',{regionId:r.id});
    const seen=new Set([r.id]);let current=parent,depth=0;
    while(current){if(seen.has(current.id)){add('REGION_CYCLE',{regionId:r.id});break;}seen.add(current.id);if(++depth>2){add('REGION_NESTING_TOO_DEEP',{regionId:r.id});break;}current=byRegion.get(current.parentId);}
   }
   for(const childId of r.childIds||[])if(byRegion.get(childId)?.parentId!==r.id)add('REGION_CHILD_BINDING_INVALID',{regionId:r.id,childId});
   for(const id of r.moduleIds||[])if(!(p.modules||[]).some(m=>m.id===id))add('REGION_MODULE_UNKNOWN',{regionId:r.id,moduleId:id});
   for(const id of r.figureIds||[]){
    const f=(p.supportFigures||[]).find(f=>f.id===id);
    if(!f||!all.includes(f.operationId)||!f.claimModuleIds?.every(id=>(r.moduleIds||[]).includes(id)))add('REGION_FIGURE_BINDING_INVALID',{regionId:r.id,figureId:id});
    const picture=f&&byOp.get(f.operationId),pb=picture&&opBox(picture,actualEvidence),minimum=f?.minimumDisplay||{};
    if(pb&&(Math.min(...pb.slice(2))<64||pb[2]*pb[3]<10000||minimum.width&&pb[2]<minimum.width-.5||minimum.height&&pb[3]<minimum.height-.5))add('REGION_FIGURE_READING_SIZE',{regionId:r.id,figureId:id,actual:pb,minimum});
    if(pb)for(const t of f.readingTargets||[]){const crop=picture.imageCrop||[0,0,0,0],width=pb[2]*t.rect[2]/(1-crop[0]-crop[2]);if(t.minimumWidthPx&&width<t.minimumWidthPx-.5)add('REGION_READING_TARGET_TOO_SMALL',{figureId:id,target:t.name,width});}
   }
   if(!r.childIds?.length)for(const o of meaningful)if(text(o)){
    if(bodyOwners.has(o.id))add('REGION_LEAF_OWNERSHIP_DUPLICATE',{operationId:o.id});
    bodyOwners.set(o.id,r);
   }
   if(!r.childIds?.length){
    const pictures=meaningful.filter(o=>o.typeId==='materials-paper-image');
    const natural=meaningful.map(o=>{
     if(o.typeId==='materials-text'||o.typeId==='materials-inset-note'){
      const b=actualEvidence?o._actualSlotBoxes?.body||o.textOptions?.body?.box:o.textOptions?.body?.box;
      if(valid(b)){const opt=o.textOptions?.body||{},h=Math.min(b[3],textHeight(fields(o).body,b[2],opt.font||17,{leading:opt.leading||112,padding:4})+10);return[b[0],b[1],b[2],h];}
     }
     return opBox(o,actualEvidence);
    });
    const content=unionRegion(natural),available=Math.max(1,r.bounds[3]-72),height=content?.[3]||0;
    if(!pictures.length&&height/available<.6)add('REGION_CONTENT_TOO_SPARSE',{regionId:r.id,naturalHeight:height,availableHeight:available,action:'收紧有内容的区域、组合相关图证或合页；框面积和居中不能解除。'});
   }
   if(actualEvidence&&frame){
    const line=frame._actualFrame;
    if(!line?.visible||line.shapeCount!==1||line.dash!=='solid'||Math.abs(line.widthPt-.25)>.02||line.color!=='0B4FA1')add('ACTUAL_REGION_FRAME_LINE_INVALID',{regionId:r.id,line});
   }
   if(frame&&members.some(o=>o&&o.id!==frame.id&&((actualEvidence?o._actualZOrder:ops.indexOf(o))<=(actualEvidence?frame._actualZOrder:ops.indexOf(frame)))))add('REGION_FRAME_Z_ORDER_INVALID',{regionId:r.id});
  }
  const usedEdges=new Set();
  for(const o of ops.filter(o=>o.annotationBinding)){
   const a=o.annotationBinding,f=(p.supportFigures||[]).find(f=>f.id===a.figureId),g=(p.modules||[]).find(g=>g.id===a.moduleId);
   if(!f||!g||!f.claimModuleIds?.includes(g.id)||!a.targetNames?.length||a.targetNames.some(n=>!g.targetNames?.includes(n)||!f.readingTargets?.some(t=>t.name===n)))add('REGION_ANNOTATION_TARGET_INVALID',{operationId:o.id});
  }
  for(const e of p.relationEdges||[]){
   const o=byOp.get(e.operationId),from=byOp.get(e.fromOperationId),to=byOp.get(e.toOperationId);
   if(!e.id||usedEdges.has(e.id)||!o||!from||!to||from===to||!['flow','causal','feedback','merge'].includes(e.kind)||!e.sourceIds?.length||e.sourceIds.some(id=>!(p.sourceIds||[]).includes(id)))add('REGION_RELATION_EVIDENCE_INVALID',{edgeId:e.id});
   usedEdges.add(e.id);
   if(o?.relationEdge?.id!==e.id||!text(from)||!text(to))add('REGION_EDGE_BINDING_INVALID',{edgeId:e.id});
   if(o&&from&&to){
    const a=opBox(from,actualEvidence),b=opBox(to,actualEvidence),c=opBox(o,actualEvidence);
    if(e.kind==='feedback'){
     const flip=actualEvidence?o._actualNativeTransform?.flipH:o.nativeTransform?.flipH;
     if(!!flip!==(a[0]>b[0]))add('REGION_FEEDBACK_DIRECTION_INVALID',{edgeId:e.id});
     if(o.typeId!=='materials-feedback-return'||c[1]+c[3]<Math.max(a[1]+a[3],b[1]+b[3])-6||c[0]>Math.min(a[0],b[0])+30||c[0]+c[2]<Math.max(a[0]+a[2],b[0]+b[2])-30)add('REGION_FEEDBACK_GEOMETRY_INVALID',{edgeId:e.id});
    }else if(e.kind==='flow'&&!(c[0]>=a[0]+a[2]-6&&c[0]+c[2]<=b[0]+6))add('REGION_FLOW_ENDPOINTS_INVALID',{edgeId:e.id});
   }
  }
  pages.push({pageId:p.id,regions:regions.length,rootRegions:regions.filter(r=>!r.parentId).length,edges:(p.relationEdges||[]).length});
 }
 return {version:1,pass:!issues.length,issues,pages,basis:actualEvidence?'actual native region lines, member geometry, ownership and relation evidence':'source-native containers and semantic member contracts'};
}
