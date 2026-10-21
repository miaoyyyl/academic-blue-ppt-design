/** Native, editable containers bound to real picture geometry. No drawing fallback. */
export const FRAME_TYPES={solid:'human-figure-frame-solid',dashed:'materials-figure-frame-dashed'};
const REGION_FRAME_TYPE='materials-mixed-region-frame';
const types=new Set(Object.values(FRAME_TYPES));
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
const union=boxes=>{const x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1]));return [x,y,Math.max(...boxes.map(b=>b[0]+b[2]))-x,Math.max(...boxes.map(b=>b[1]+b[3]))-y];};
const padded=(b,p)=>[b[0]-p,b[1]-p,b[2]+p*2,b[3]+p*2];
export function makeFigureFrame(figures,operations,{id,style='solid',padding=4,reason,scope='image'}={}){
 if(!FRAME_TYPES[style]||!Number.isFinite(padding)||padding<2||padding>12)throw Error('FIGURE_FRAME_STYLE_OR_PADDING_INVALID');
 if(!['image','group'].includes(scope)||scope==='image'&&figures.length!==1||scope==='group'&&figures.length<2)throw Error('FIGURE_FRAME_SCOPE_INVALID');
 const pics=figures.map(f=>operations.find(o=>o.id===f.operationId&&o.typeId==='materials-paper-image'));
 if(pics.some(p=>!valid(p?.bounds)))throw Error('FIGURE_FRAME_IMAGE_BINDING_INVALID');
 const bounds=padded(union(pics.map(o=>o.bounds)),padding);
 if(bounds[0]<0||bounds[1]<0||bounds[0]+bounds[2]>1280||bounds[1]+bounds[3]>720)throw Error('FIGURE_FRAME_OUT_OF_CANVAS');
 const op={id,typeId:FRAME_TYPES[style],bounds,fields:{},textOptions:{},componentTask:'figure-container',
  figureFrame:{style,scope,padding,figureIds:figures.map(f=>f.id),reason:reason||'用原生实线框界定独立图片或证据的阅读范围。'}};
 for(const f of figures){f.frameOperationId=id;f.frameStyle=style;f.frameScope=scope;f.framePadding=padding;}
 return op;
}
export function combineFigureFrames(state,options){
 if(!options)return;
 if(options.scope!=='group')throw Error('FIGURE_FRAME_GROUP_OPTION_INVALID');
 const previous=new Set(state.supportFigures.map(f=>f.frameOperationId));
 state.operations=state.operations.filter(o=>!previous.has(o.id));
 const id=state.supportFigures[0].id+'-shared-frame';
 const op=makeFigureFrame(state.supportFigures,state.operations,{id,...options});
 // Captions belong below the shared container, even when pictures have different heights.
 const captionY=op.bounds[1]+op.bounds[3]+5;
 for(const f of state.supportFigures){
  const caption=state.operations.find(o=>o.id===f.captionOperationId);if(!caption)continue;
  const delta=captionY-caption.bounds[1];caption.bounds=[caption.bounds[0],captionY,...caption.bounds.slice(2)];
  for(const text of Object.values(caption.textOptions||{}))if(text.box)text.box=[text.box[0],text.box[1]+delta,...text.box.slice(2)];
 }
 const first=state.operations.findIndex(o=>state.supportFigures.some(f=>f.operationId===o.id));
 state.operations.splice(first,0,op);
 for(const b of state.bindings)if(b.kind==='figure')b.frameOperationId=id;
}
export function auditFigureFrames(plan,{actualEvidence=false}={}){
 const issues=[],pages=[];
 for(const p of plan.pages||[]){
  if(p.role!=='content')continue;
  const ops=p.operations||[],byId=new Map(ops.map(o=>[o.id,o])),figs=p.supportFigures||[],seen=new Set();
  const add=(code,d={})=>issues.push({code,pageId:p.id,...d});
  for(const pic of ops.filter(o=>o.typeId==='materials-paper-image')){
   const f=figs.find(f=>f.operationId===pic.id&&f.assetId===pic.assetId),frame=f&&byId.get(f.frameOperationId);
   if(f?.frameScope==='region'){
    const region=(p.contentRegions||[]).find(r=>r.id===f.regionId&&r.kind==='mixed-region'&&r.frameOperationId===frame?.id);
    if(!region||frame?.typeId!==REGION_FRAME_TYPE||!region.figureIds?.includes(f.id)||!region.operationIds?.includes(pic.id)||frame.regionContainer?.regionId!==region.id)add('FIGURE_REGION_CONTAINER_INVALID',{figureId:f.id});
    if(region&&!region.operationIds?.includes(f.captionOperationId)&&f.captionOperationId)add('FIGURE_REGION_CAPTION_UNBOUND',{figureId:f.id});
    continue;
   }
   if(!frame||!types.has(frame.typeId)){add('FIGURE_NATIVE_FRAME_REQUIRED',{operationId:pic.id,figureId:f?.id});continue;}
   if(!FRAME_TYPES[f.frameStyle]||FRAME_TYPES[f.frameStyle]!==frame.typeId||!frame.figureFrame?.figureIds?.includes(f.id))add('FIGURE_FRAME_BINDING_INVALID',{figureId:f.id});
   seen.add(frame.id);
  }
  for(const frame of ops.filter(o=>types.has(o.typeId))){
   const meta=frame.figureFrame,owned=figs.filter(f=>f.frameOperationId===frame.id);
   if(!seen.has(frame.id)||!owned.length){add('ORPHAN_FIGURE_FRAME',{operationId:frame.id});continue;}
   const members=owned.map(f=>byId.get(f.operationId));
   if(members.some(o=>o?.typeId!=='materials-paper-image')){add('FIGURE_FRAME_IMAGE_BINDING_INVALID',{operationId:frame.id});continue;}
   if(!meta||FRAME_TYPES[meta.style]!==frame.typeId||!['image','group'].includes(meta.scope)||meta.scope==='image'&&owned.length!==1||meta.scope==='group'&&owned.length<2||!Number.isFinite(meta.padding)||meta.padding<2||meta.padding>12||!meta.reason?.trim()||new Set(meta.figureIds).size!==owned.length||meta.figureIds.some(id=>!owned.some(f=>f.id===id))||owned.some(f=>f.frameScope!==meta.scope||f.frameStyle!==meta.style||f.framePadding!==meta.padding)){
    add('FIGURE_FRAME_METADATA_INVALID',{operationId:frame.id});continue;
   }
   const rect=actualEvidence?frame._actualOperationBounds:frame.bounds;
   const boxes=members.map(o=>actualEvidence?o._actualOperationBounds:o.bounds);
   if(!valid(rect)||boxes.some(b=>!valid(b))){add('FIGURE_FRAME_GEOMETRY_UNRESOLVED',{operationId:frame.id});continue;}
   const expected=padded(union(boxes),meta.padding);
   if(expected.some((v,i)=>Math.abs(v-rect[i])>.7))add('FIGURE_FRAME_NOT_TIGHT_TO_IMAGES',{operationId:frame.id,expected,actual:rect});
   for(const f of owned){
    if(!f.captionOperationId)continue;
    const cap=byId.get(f.captionOperationId),capBox=actualEvidence?cap?._actualOperationBounds:cap?.bounds;
    if(!valid(capBox)||capBox[1]<rect[1]+rect[3]+5-.7)add('FIGURE_CAPTION_OVERLAPS_FRAME',{figureId:f.id,operationId:frame.id});
   }
   const order=o=>actualEvidence?o._actualZOrder:ops.indexOf(o);
   if(!Number.isFinite(order(frame))||members.some(o=>!Number.isFinite(order(o)))||order(frame)>=Math.min(...members.map(order)))add('FIGURE_FRAME_Z_ORDER_INVALID',{operationId:frame.id});
   if(actualEvidence){
    const line=frame._actualFrame;
    const dash=meta.style==='solid'?'solid':'lgDash',width=meta.style==='solid'?1:.75;
    if(!line?.visible||line.shapeCount!==1||line.dash!==dash||Math.abs(line.widthPt-width)>.02||line.color!==(meta.style==='solid'?'003F88':'0C56AE'))add('ACTUAL_FIGURE_FRAME_LINE_INVALID',{operationId:frame.id,line});
   }
  }
  pages.push({pageId:p.id,images:ops.filter(o=>o.typeId==='materials-paper-image').length,frames:seen.size,solid:ops.filter(o=>o.typeId===FRAME_TYPES.solid).length,dashed:ops.filter(o=>o.typeId===FRAME_TYPES.dashed).length});
 }
 return {version:1,pass:!issues.length,issues,pages,basis:actualEvidence?'actual native picture and frame geometry, line appearance and order':'bound native frame prototypes; actual rendering still required'};
}
