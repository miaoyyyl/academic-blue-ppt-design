/** Inspect visible native body geometry; palette and recipe names are not structure. */
const structural=new Set(['materials-gradient-tab','materials-badge-panel','materials-filled-column','materials-flow-step','human-left-label-band','materials-circle-numbered-row','materials-outline-condition','materials-two-input-merge','materials-timeline-three','materials-timeline-four','materials-hexagon-explanation','materials-brace-group','materials-cycle-three','human-comparison-table','human-response-table']);
const text=v=>(Array.isArray(v)?v.flat(Infinity):[v]).map(v=>String(v??'')).join('');
const box=o=>o._actualOperationBounds||o.bounds;
const union=bs=>{if(!bs.length)return null;const x=Math.min(...bs.map(b=>b[0])),y=Math.min(...bs.map(b=>b[1]));return[x,y,Math.max(...bs.map(b=>b[0]+b[2]))-x,Math.max(...bs.map(b=>b[1]+b[3]))-y];};

export function structureSignature(page){
 const ops=page.operations||[],byId=new Map(ops.map(o=>[o.id,o])),owned=new Set(),regions=[];
 for(const group of page.contentGroups||[]){
  const ids=[group.anchorId,...(group.memberIds||[])];ids.forEach(id=>owned.add(id));
  const b=union(ids.map(id=>byId.get(id)).filter(Boolean).map(box));if(b)regions.push({kind:'B',box:b});
 }
 for(const o of ops)if(structural.has(o.typeId)&&!owned.has(o.id))regions.push({kind:'B',box:box(o)});
 const figures=ops.filter(o=>o.typeId==='materials-paper-image'&&o.assetId).map(o=>({kind:'P',box:box(o)}));
 const types=[...new Set(ops.filter(o=>structural.has(o.typeId)).map(o=>o.typeId))];
 const special=[['materials-cycle-three','cycle'],['human-comparison-table','matrix'],['human-response-table','problem-response'],['materials-timeline-three','timeline'],['materials-two-input-merge','merge'],['materials-brace-group','branch'],['materials-hexagon-explanation','classification'],['materials-circle-numbered-row','numbered'],['materials-flow-step','process'],['human-left-label-band','labeled-rows']].find(([type])=>types.includes(type));
 let family=special?.[1]||'titled-regions';
 const mixed=(page.contentRegions||[]).filter(r=>r.kind==='mixed-region');
 if(mixed.length){
  const leaves=mixed.filter(r=>!r.childIds?.length),flow=leaves.some(r=>(r.operationIds||[]).some(id=>byId.get(id)?.typeId==='materials-flow-step')),merge=leaves.some(r=>(r.operationIds||[]).some(id=>byId.get(id)?.typeId==='materials-two-input-merge'));
  family=flow&&merge?'layered-relations':flow?'local-process':leaves.some(r=>r.layout==='callouts')?'localized-callouts':leaves.some(r=>['figure-left','figure-right'].includes(r.layout))?'mixed-side-regions':'mixed-stacked-regions';
  for(const r of mixed)regions.push({kind:r.parentId?'C':'R',box:r.bounds});
 }
 const total=union([...regions,...figures].map(r=>r.box))||[44,177,1192,480];
 const canonical=mirror=>[...regions,...figures].map(r=>{const b=r.box,cx=(b[0]+b[2]/2-total[0])/Math.max(1,total[2]),cy=(b[1]+b[3]/2-total[1])/Math.max(1,total[3]);return[r.kind,Math.round((mirror?1-cx:cx)*5),Math.round(cy*5),Math.round(b[2]/Math.max(1,total[2])*4),Math.round(b[3]/Math.max(1,total[3])*4)].join(':');}).sort().join('/');
 const a=canonical(false),b=canonical(true);
 const topology=mixed.map(r=>[(r.parentId?'child':'root'),r.layout,r.childIds?.length||0,(r.figureIds||[]).length,(r.moduleIds||[]).length].join(':')).sort().join('/');
 return {family,fingerprint:family+'|'+(a<b?a:b)+(topology?'|'+topology:''),structureTypes:types,bodyRegions:regions.length,figures:figures.length};
}

function coherentSeries(rows){
 if(!rows.length)return false;const s=rows[0].series;
 if(!s?.id||!s.reason||s.reason.length<18||!s.sourceIds?.length)return false;
 return rows.every(r=>r.series?.id===s.id&&r.series?.reason===s.reason&&rows.every(other=>r.series.pageIds?.includes(other.pageId))&&s.sourceIds.some(id=>r.sourceIds.includes(id))&&r.bodyRegions>0);
}

export function auditLayoutDiversity(plan,{bodyRows=[]}={}){
 const pages=(plan.pages||[]).filter(p=>p.role==='content').map(p=>{
  const shape=structureSignature(p),body=bodyRows.find(r=>r.pageId===p.id);
  // Main body weight is measured separately; a tiny incidental label cannot rename a card page.
  const dominant=body?.dominant;
  if(['capsule-group','blue-top-card'].includes(dominant)&&!shape.structureTypes.some(t=>['human-comparison-table','human-response-table','materials-cycle-three','materials-timeline-three','materials-two-input-merge'].includes(t)))shape.family='titled-regions';
  return {pageId:p.id,chapterId:p.chapterId,sourceIds:p.sourceIds||[],series:p.compositionSeries,...shape};
 });
 const counts={},fingerprints={},issues=[];
 for(const p of pages){counts[p.family]=(counts[p.family]||0)+1;(fingerprints[p.fingerprint]??=[]).push(p);}
 const add=(code,rows,details={})=>{if(!coherentSeries(rows))issues.push({code,pages:rows.map(p=>p.pageId),...details,message:'按内容复核实际关系、图文区域及章节节奏；换色、换名和泛化理由不能解除结构重复。'});};
 if(pages.length>=8){
  const titled=pages.filter(p=>p.family==='titled-regions');
  if(titled.length/pages.length>.65)add('SIMILAR_BODY_FORMS_DOMINATE',titled,{share:titled.length/pages.length,threshold:.65});
  for(const rows of Object.values(fingerprints))if(rows.length/pages.length>.5)add('PAGE_TOPOLOGY_DOMINATES',rows,{share:rows.length/pages.length,threshold:.5});
  const chapters=[...new Set(pages.map(p=>p.chapterId).filter(Boolean))];
  for(const ch of chapters){const rows=pages.filter(p=>p.chapterId===ch),same=rows.filter(p=>p.family==='titled-regions');if(rows.length>=4&&same.length/rows.length>=.8)add('CHAPTER_STRUCTURE_CONCENTRATED',same,{chapterId:ch,share:same.length/rows.length});}
 }
 let run=[];const flush=()=>{if(run.length>=3)add('CONSECUTIVE_SIMILAR_TOPOLOGY',run);run=[];};
 for(const p of pages){if(run.length&&run[0].fingerprint!==p.fingerprint)flush();run.push(p);}flush();
 return {version:1,pass:issues.length===0,basis:'Native body objects, bound groups and actual figure geometry. Ignores color, recipe labels and public headers. Thresholds trigger content review, not a layout quota.',familyCounts:counts,distinctTopologies:Object.keys(fingerprints).length,issues,pages};
}
