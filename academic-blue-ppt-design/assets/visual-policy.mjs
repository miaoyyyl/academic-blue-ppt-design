/** Task-aware figure selection and natural-content review. Declarations are not visual approval. */
import {textHeight} from './narrative-layout.mjs';
import {summaryHasTerminalPunctuation} from './summary-copy.mjs';
import {isPageClaim,claimSlot,auditPageLeads} from './page-lead.mjs';
export {isPageClaim} from './page-lead.mjs';
const intents=new Set(['application','mechanism','phenomenon','data','context']);
const fits={application:['scene','object'],mechanism:['mechanism'],phenomenon:['phenomenon','scene'],data:['data'],context:['scene','object','phenomenon']};
const bands=new Set(['human-gradient-statement','materials-statement-band','materials-gradient-conclusion']);
const panels=new Set(['human-left-label-band','materials-filled-column','materials-badge-panel','materials-flow-step','materials-circle-numbered-row','materials-hexagon-explanation']);
const flat=v=>(Array.isArray(v)?v.flat(Infinity):[v]).map(x=>String(x??''));
const box=(o,s,actual)=>actual&&o._actualSlotBoxes?.[s]||o.textOptions?.[s]?.box||o.bounds;
const hasImage=(p,f)=>{
 const o=(p.operations||[]).find(o=>o.id===f.operationId&&o.typeId==='materials-paper-image'&&o.assetId===f.assetId);
 return o&&o.bounds[2]*o.bounds[3]>=20000&&Math.min(...o.bounds.slice(2))>=100;
};
export function naturalContentHeight(page,{actualEvidence=false}={}){
 if((page.contentRegions||[]).some(r=>r.kind==='mixed-region')){
  const exclude=new Set((page.contentRegions||[]).flatMap(r=>[r.frameOperationId,r.headingOperationId]));
  const body=(page.operations||[]).filter(o=>!exclude.has(o.id)&&o.semanticRole!=='lane-label'&&o.typeId!=='materials-caption'&&(Object.values(o.fields||{}).flat(Infinity).join('').trim()||o.typeId==='materials-paper-image'));
  const bs=body.map(o=>{
   const b=actualEvidence?o._actualOperationBounds||o.bounds:o.bounds;
   if(o.typeId==='materials-text'){const tb=box(o,'body',actualEvidence),opt=o.textOptions?.body||{};return[tb[0],tb[1],tb[2],Math.min(tb[3],textHeight(flat(o.fields.body),tb[2],opt.font||17,{leading:opt.leading||112})+10)];}
   return b;
  });
  return bs.length?Math.max(...bs.map(b=>b[1]+b[3]))-Math.min(...bs.map(b=>b[1])):0;
 }
 const ops=page.operations||[],items=[],owned=new Set();
 for(const g of page.contentGroups||[]){
  const anchor=ops.find(o=>o.id===g.anchorId);if(!anchor)continue;
  const members=ops.filter(o=>g.memberIds?.includes(o.id));
  const body=members.map(o=>{const b=box(o,'body',actualEvidence);return textHeight(flat(o.fields?.body),b[2],o.textOptions?.body?.font||17,{leading:112})+10;});
  if(body.length){items.push({y:anchor.bounds[1],h:(anchor.typeId==='materials-two-input-merge'?anchor.bounds[3]+24:53)+body.reduce((a,b)=>a+b,0)});members.forEach(o=>owned.add(o.id));}
 }
 for(const o of ops){
  if(owned.has(o.id)||isPageClaim(o)||!panels.has(o.typeId))continue;
  const b=box(o,'body',actualEvidence),opt=o.textOptions?.body||{};
  const need=textHeight(flat(o.fields?.body),b[2],opt.font||17,{leading:opt.leading||112})+12;
  items.push({y:o.bounds[1],h:need+(o.typeId==='human-left-label-band'||o.typeId==='materials-hexagon-explanation'?20:o.typeId==='materials-circle-numbered-row'?43:66)});
 }
 const rows=[];for(const item of items.sort((a,b)=>a.y-b.y)){
  const row=rows.find(r=>Math.abs(r.y-item.y)<12);
  if(row)row.h=Math.max(row.h,item.h);else rows.push({...item});
 }
 return rows.reduce((n,r)=>n+r.h,0)+Math.max(0,rows.length-1)*24;
}
export function auditVisualPlan(plan,{actualEvidence=false}={}){
 const leadAudit=auditPageLeads(plan,{actualEvidence});const issues=[...leadAudit.issues],pages=[];
 for(const p of plan.pages||[]){
  if(p.role!=='content')continue;
  const add=(code,details={})=>issues.push({code,pageId:p.id,...details});
  const modules=new Map((p.modules||[]).map(m=>[m.id,m]));
  for(const m of modules.values())if(!intents.has(m.visualIntent))add('MODULE_VISUAL_INTENT_REQUIRED',{moduleId:m.id});
  for(const f of p.supportFigures||[]){
   if(!f.figureType||!f.claimModuleIds?.length||f.claimModuleIds.some(id=>!modules.has(id)))add('FIGURE_TASK_BINDING_REQUIRED',{figureId:f.id});
   if(f.figureType==='mixed'&&!(f.readingTargets||[]).every(t=>intents.has(t.visualIntent)))add('MIXED_FIGURE_REGION_INTENT_REQUIRED',{figureId:f.id});
   for(const id of f.claimModuleIds||[]){
    const m=modules.get(id);if(!m||!intents.has(m.visualIntent))continue;
    const compatible=f.figureType==='mixed'?(f.readingTargets||[]).some(t=>t.visualIntent===m.visualIntent):fits[m.visualIntent].includes(f.figureType);
    if(!compatible)add('FIGURE_TASK_MISMATCH',{figureId:f.id,moduleId:id,visualIntent:m.visualIntent,figureType:f.figureType});
   }
  }
  for(const o of p.operations||[]){
   if(isPageClaim(o)){
    const slot=claimSlot(o),summary=actualEvidence?o._actualFields?.[slot]:o.fields?.[slot];
    if(summaryHasTerminalPunctuation(summary))add('PAGE_SUMMARY_TERMINAL_PUNCTUATION',{operationId:o.id,actualEvidence,message:'顶部综述句末不加句号、逗号、分号、冒号、问号、叹号或省略号；保留小数点、单位及必要的科学符号。'});
    const align=actualEvidence?o._actualParagraphAlignments?.[slot]:[o.textOptions?.[slot]?.align];
    if(!align?.length||align.some(a=>a!=='ctr'))add('PAGE_CLAIM_NOT_CENTERED',{operationId:o.id,actualEvidence});
    const b=box(o,slot,actualEvidence);if(Math.abs(b[0]+b[2]/2-640)>6)add('PAGE_CLAIM_BOX_OFF_CENTER',{operationId:o.id});
   }else if(o.fields?.body&&o.typeId!=='materials-frame'&&!['lane-label','region-conclusion'].includes(o.semanticRole)){
    const a=actualEvidence?o._actualParagraphAlignments?.body:[o.textOptions?.body?.align||'l'];
    if(a?.some(v=>v==='ctr'))add('EXPLANATION_BODY_CENTERED',{operationId:o.id});
   }
   if(o.typeId==='human-left-label-band'&&(p.supportFigures||[]).length&&o.bounds[2]<650){
    const b=box(o,'body',actualEvidence);if(b[2]<340)add('FIGURE_LABEL_BODY_TOO_NARROW',{operationId:o.id,width:b[2],minimum:340});
   }
  }
  const naturalHeight=naturalContentHeight(p,{actualEvidence}),available=(p.compositionBounds||[44,177,1192,480])[3];
  const meaningful=(p.supportFigures||[]).filter(f=>hasImage(p,f));
  const sparse=naturalHeight>0&&naturalHeight/available<.6;
  if(sparse&&!meaningful.length)add('SPARSE_CONTENT_REQUIRES_VISUAL_OR_MERGE',{naturalHeight,availableHeight:available,action:'先策划语义相关配图，仍不能独立成页则合并；居中、拉框或自填通过理由不能解除。'});
  pages.push({pageId:p.id,naturalHeight,availableHeight:available,meaningfulFigures:meaningful.length,sparse,sparseReview:sparse?'核对局部自然内容、图片职责及替代组合；有图片仍须复核':null,visualReviewRequired:true});
 }
 return {version:1,pass:!issues.length,issues,pages};
}
