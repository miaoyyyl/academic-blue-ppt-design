/** Shared figure/text edges, measured from native objects and rendered glyph bounds. */
import {textHeight} from './narrative-layout.mjs';
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
const open=new Set(['materials-text','human-dot-notes','human-check-notes','human-square-notes','materials-arrow-notes','materials-diamond-notes']);
export function joined(boxes){const a=boxes.filter(valid);if(!a.length)return null;const x=Math.min(...a.map(b=>b[0])),y=Math.min(...a.map(b=>b[1]));return[x,y,Math.max(...a.map(b=>b[0]+b[2]))-x,Math.max(...a.map(b=>b[1]+b[3]))-y];}
export function visibleBox(o,slot,actual=false){
 if(!o)return null;
 if(slot){
  if(actual&&valid(o._renderedSlotBounds?.[slot]))return o._renderedSlotBounds[slot];
  const b=o.textOptions?.[slot]?.box||o.bounds,opt=o.textOptions?.[slot]||{},v=o.fields?.[slot],paras=Array.isArray(v)?v:[v];
  if(!valid(b)||v==null)return null;
  return[b[0],b[1],b[2],Math.min(b[3],textHeight(paras,b[2],opt.font||17,{leading:opt.leading||112,padding:0})+Math.max(0,paras.length-1)*(opt.paragraphAfter??5)+6)];
 }
 return actual&&valid(o._actualOperationBounds)?o._actualOperationBounds:o.bounds;
}
function edge(state,g,end,actual){const ref=g[end]||{operationId:end==='start'?g.operationIds[0]:g.operationIds.at(-1),slot:end==='end'?'body':undefined};const o=state.operations.find(o=>o.id===ref.operationId);const b=visibleBox(o,ref.slot,actual);return b?(end==='end'?b[1]+b[3]:b[1]):null;}
export function alignPairedRegions(state,{actual=false,move}={}){
 const changes=[];
 for(const pair of state.pairedRegions||[]){
  const frame=state.operations.find(o=>o.id===pair.frameOperationId),fb=visibleBox(frame,null,actual);if(!fb)continue;
  for(const g of pair.groups)for(const id of g.operationIds){
   const o=state.operations.find(o=>o.id===id);if(!o||!open.has(o.typeId))continue;
   const opt=o.textOptions?.body,b=visibleBox(o,'body',actual);if(!opt?.box||!b)continue;
   const height=actual?b[3]+2:Math.min(opt.box[3],b[3]);opt.box=[...opt.box.slice(0,3),height];o.bounds=[...o.bounds.slice(0,3),height];
  }
  const groups=pair.groups.map(g=>({g,top:edge(state,g,'start',actual),bottom:edge(state,g,'end',actual)})).filter(g=>g.top!=null&&g.bottom!=null);
  if(!groups.length)continue;
  const total=groups.reduce((n,g)=>n+g.bottom-g.top,0),gap=groups.length>1?(fb[3]-total)/(groups.length-1):0;
  if(gap<12&&groups.length>1){pair.fit='text-taller-than-figure';continue;}
  let y=fb[1];
  for(const item of groups){const dy=y-item.top;move(state,item.g.operationIds,0,dy);changes.push({pairId:pair.id,groupIds:item.g.operationIds,dy});y+=item.bottom-item.top+gap;}
  pair.fit='shared-edges';
  for(const id of pair.decorationIds||[]){
   const o=state.operations.find(o=>o.id===id);if(!o)continue;
   o.bounds=[o.bounds[0],fb[1],o.bounds[2],fb[3]];
  }
  for(const id of pair.centerOperationIds||[]){const o=state.operations.find(o=>o.id===id);if(o){const b=visibleBox(o,null,actual);move(state,[id],0,fb[1]+fb[3]/2-b[1]-b[3]/2);}}
  for(const g of state.contentGroups||[])if((pair.decorationIds||[]).includes(g.anchorId))g.bounds=joined(state.operations.filter(o=>[g.anchorId,...g.memberIds].includes(o.id)).map(o=>o.bounds));
 }
 return changes;
}
export function auditPairedRegions(page,{actualEvidence=false}={}){
 const issues=[],pairs=[];
 const requiresPair=(page.supportFigures||[]).length===1&&(['figure-with-explanations','numbered-with-evidence','branch-with-evidence'].includes(page.compositionId)||page.compositionId==='merge-with-evidence'&&(page.compositionOptions?.notesPlacement||'below')==='below');
 if(requiresPair&&!page.pairedRegions?.length)issues.push({code:'PAIRED_LAYOUT_BINDING_REQUIRED',pageId:page.id,compositionId:page.compositionId});
 for(const pair of page.pairedRegions||[]){
  const frame=page.operations.find(o=>o.id===pair.frameOperationId),fb=visibleBox(frame,null,actualEvidence);
  const groups=(pair.groups||[]).map(g=>({top:edge(page,g,'start',actualEvidence),bottom:edge(page,g,'end',actualEvidence)}));
  if(!fb||!groups.length||groups.some(g=>g.top==null||g.bottom==null)){issues.push({code:'PAIRED_BINDING_INVALID',pageId:page.id,pairId:pair.id});continue;}
  const topDelta=groups[0].top-fb[1],bottomDelta=groups.at(-1).bottom-fb[1]-fb[3];
  const topPass=Math.abs(topDelta)<=8,bottomPass=groups.length===1&&!pair.bottomRequired||Math.abs(bottomDelta)<=26;
  if(!topPass)issues.push({code:'PAIRED_TOP_EDGE_MISMATCH',pageId:page.id,pairId:pair.id,topDelta});
  if(!bottomPass)issues.push({code:'PAIRED_BOTTOM_EDGE_REVIEW',pageId:page.id,pairId:pair.id,bottomDelta});
  pairs.push({pairId:pair.id,topDelta,bottomDelta,topPass,bottomPass,groupCount:groups.length});
 }
 return{pass:!issues.length,issues,pairs};
}
export function attachRenderedGeometry(input,bindings,rendered){
 const plan=structuredClone(input),issues=[];
 for(const[i,p]of plan.pages.entries()){
  const r=rendered.find(v=>v.page===i+1);if(!r){issues.push({code:'SPATIAL_RENDER_PAGE_MISSING',page:i+1});continue;}
  for(const[j,o]of(p.operations||[]).entries()){
   const parts=(r.objects||[]).filter(v=>v.name.startsWith('native.'+j+'.'));
   const toBox=v=>[v.left,v.top,v.width,v.height].map(n=>n*4/3),b=joined(parts.map(v=>v.visualBounds?.length===4?v.visualBounds.map(n=>n*4/3):toBox(v)));
   if(b)o._actualOperationBounds=b;
   o._renderedSlotBounds={};
   for(const binding of bindings.filter(b=>b.page===i+1&&b.operation===j&&b.slot!=='image')){
    const t=(r.texts||[]).find(t=>t.name===binding.name&&t.text?.trim());if(t)o._renderedSlotBounds[binding.slot]=toBox(t);
   }
   if(open.has(o.typeId)&&o._renderedSlotBounds.body)o._actualRenderedBounds=o._renderedSlotBounds.body;
  }
 }
 return{plan,issues};
}
