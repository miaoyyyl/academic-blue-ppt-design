/** Mandatory structure and numeric-emphasis checks; layout names are not evidence. */
import fs from 'node:fs';
import path from 'node:path';
import {bankDir,findCases} from './native-components/api.mjs';
import {auditVisualPlan} from './visual-policy.mjs';
import {auditSpatialLayout} from './spatial-layout.mjs';
import {auditFigureFrames} from './figure-frame-policy.mjs';
import {auditLayoutDiversity,structureSignature} from './layout-diversity.mjs';
import {auditRelationshipEvidence} from './relation-compositions.mjs';
import {isPageClaim} from './page-lead.mjs';
import {auditRegions} from './region-policy.mjs';
import {auditComponentPolish} from './component-polish.mjs';
import {auditReferenceLayouts} from './reference-layouts.mjs';
const registry=new Map(findCases().map(c=>[c.typeId,c]));
const openTypes=new Set(['materials-text','materials-arrow-notes','human-check-notes','human-square-notes','materials-diamond-notes','human-dot-notes']);
const structures=new Set(['materials-badge-panel','materials-filled-column','materials-flow-step','materials-timeline-three','materials-timeline-four',
  'materials-circle-numbered-row','materials-outline-condition','materials-two-input-merge','human-left-label-band',
  'human-arrow-outline-list','materials-hexagon-explanation','human-comparison-table','human-response-table','materials-cycle-three']);
const bands=new Set(['materials-statement-band','human-gradient-statement','materials-gradient-conclusion']);
const decorations=new Set(['materials-frame','materials-cover','materials-navigation','materials-caption']);
const anchors=new Set(['materials-gradient-tab','materials-brace-group','materials-two-input-merge','materials-cycle-three']);
const blueObjects={'materials-gradient-tab':'33','materials-filled-column':'15','materials-badge-panel':'14','materials-flow-step':'81','human-left-label-band':'4'};
const flat=v=>Array.isArray(v)?v.map(flat).join('\n'):String(v??'');
const length=v=>flat(v).replace(/\s/g,'').length;
const validBox=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
const area=b=>validBox(b)?b[2]*b[3]:0;
const contains=(a,b,t=3)=>validBox(a)&&validBox(b)&&b[0]>=a[0]-t&&b[1]>=a[1]-t&&b[0]+b[2]<=a[0]+a[2]+t&&b[1]+b[3]<=a[1]+a[3]+t;
const boxOf=(o,s)=>o._actualSlotBoxes?.[s]||o.textOptions?.[s]?.box||o.bounds;
const regionOf=o=>o._actualRegionBox||o.bounds;
const fieldsOf=o=>o._actualFields||o.fields||{};
const visibleText=o=>Object.values(fieldsOf(o)).some(v=>length(v));
const bodySlots=o=>Object.keys(fieldsOf(o)).filter(s=>!['heading','label','number','image'].includes(s)&&!/^date\d+$/.test(s));
const bodyWeight=o=>bodySlots(o).reduce((n,s)=>n+length(fieldsOf(o)[s]),0);
const commonThesis=isPageClaim;
export function treatmentOf(typeId){
  const c=registry.get(typeId);if(c?.visualTreatment)return c.visualTreatment;
  return ({'materials-badge-panel':'blue-top-card','materials-filled-column':'blue-top-card',
    'materials-flow-step':'ordered-step','materials-flow-arrow':'directional-link',
    'materials-timeline-three':'timeline','materials-circle-numbered-row':'numbered-row',
    'materials-outline-condition':'outline-condition','materials-two-input-merge':'merge',
    'materials-gradient-connector':'directional-link','materials-text':'open-text',
    'materials-paper-image':'evidence-image','materials-side-label':'side-label'})[typeId]||'shared-foundation';
}
function hasVisualStructure(o){
  const sid=blueObjects[o.typeId],b=o._actualAnchorBox||(sid&&o.objectBoxes?.[sid])||o.bounds;
  const min=o.typeId==='materials-brace-group'?[12,60]:[80,18];
  return o._structureVisible!==false&&validBox(b)&&b[2]>=min[0]&&b[3]>=min[1];
}
function libraryFixture(p){
  if(p.role!=='component-test'||!/^[a-z0-9-]+$/.test(p.id||''))return false;
  const f=path.join(bankDir,'examples',p.id+'.json');if(!fs.existsSync(f))return false;
  const expected=JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
  const ops=(p.operations||[]).map(o=>Object.fromEntries(Object.entries(o).filter(([k])=>!k.startsWith('_actual')&&k!=='_structureVisible')));
  return JSON.stringify(ops)===JSON.stringify(expected.operations)&&(p.operations||[]).every(o=>!o._actualFields||Object.entries(o.fields||{}).every(([s,v])=>flat(o._actualFields[s])===flat(v)));
}
function specialRole(p){
  const types=(p.operations||[]).map(o=>o.typeId);
  if(['cover','closing'].includes(p.role))return types.includes('materials-cover')&&types.every(t=>['materials-cover','materials-text','materials-caption'].includes(t))&&(p.operations||[]).filter(o=>o.typeId==='materials-text').every(o=>bodyWeight(o)<=100);
  if(p.role==='toc')return types.length>0&&types.every(t=>t==='materials-navigation');
  if(p.role==='reference')return (/参考|文献|来源|资料|reference|bibliograph/i.test(p.title||'')||p.referenceText?.length>0)&&types.length>0&&types.every(t=>['materials-frame','materials-text','materials-caption',...bands].includes(t));
  return false;
}
function numberLike(text){return /\d/u.test(text.normalize('NFKC'))||/[一二三四五六七八九十百千万亿零两]+(?:万|亿|千|百|成|倍|%|％)/u.test(text);}
function shortMetric(text){
  const s=text.normalize('NFKC').replace(/\s/g,'');if(s.length>32)return false;
  return s.replace(/[\d.,+\-−~≈<>≤≥=/%‰°℃×^()（）:：年月日千百万亿零一二三四五六七八九十两]+/g,'')
    .replace(/(?:km|cm|mm|kg|ha|CO2|m2|m3|万元|亿元|公顷|平方公里|平方千米|百分之|吨|个|项|倍|人|亩)/gi,'').length<=8;
}
function numericIssues(p,ops){
  const issues=[];
  ops.forEach((o,index)=>{
    if(['materials-frame','materials-cover','materials-navigation'].includes(o.typeId))return;
    for(const [slot,value]of Object.entries(fieldsOf(o))){
      const text=flat(value);if(!numberLike(text))continue;
      const opts=o.textOptions?.[slot]||{},runs=o._actualTextRuns?.[slot];
      const fonts=runs?.length?runs.filter(r=>numberLike(r.text)).map(r=>r.font):[opts.font??registry.get(o.typeId)?.defaultTextOptions?.[slot]?.font];
      if(!fonts.length)continue;
      if(fonts.some(f=>!Number.isFinite(f)||f<=0)){
        issues.push({code:'NUMERIC_FONT_UNRESOLVED',pageId:p.id,operation:index,slot,message:'数值文字必须明确实际字号，不能依赖未知继承。'});continue;
      }
      const maxFont=Math.max(...fonts);
      const structuralLabel=(['materials-timeline-three','materials-timeline-four'].includes(o.typeId)&&/^date\d+$/.test(slot))||(o.typeId==='materials-circle-numbered-row'&&slot==='number');
      if(maxFont>24||(!structuralLabel&&shortMetric(text)&&maxFont>22))issues.push({code:'NUMERIC_SPOTLIGHT_FORBIDDEN',pageId:p.id,operation:index,slot,text:text.slice(0,90),maxFont,
        message:'禁止大字号数值突出；数值与单位、条件和比较依据须回到正常字号正文、表格或数据图。'});
    }
  });return issues;
}
function seriesReviewed(group){
  if(!group.length)return false;
  const ids=group.map(p=>p.pageId),first=group[0].series;
  return first&&typeof first.id==='string'&&first.id.length>0&&typeof first.reason==='string'&&first.reason.trim().length>=12&&
    group.every(p=>p.series?.id===first.id&&p.series.reason===first.reason&&Array.isArray(p.series.pageIds)&&ids.every(id=>p.series.pageIds.includes(id))&&
      Array.isArray(p.series.sourceIds)&&p.series.sourceIds.length>0&&p.series.sourceIds.every(id=>p.sourceIds.includes(id)));
}
// A source figure may separate a heading from its explanation, as in a scientific
// comparison column. The gap is valid only when the declared figure really fills it
// and supports the same visible module. An arbitrary image cannot rescue loose text.
function figureBridgesGroup(p,g,anchor,bodyBoxes,ops,byId,ownedImages){
  const ids=g.imageMemberIds||[],moduleIds=g.moduleIds||[];
  if(!ids.length||new Set(ids).size!==ids.length||!moduleIds.length||new Set(moduleIds).size!==moduleIds.length)return false;
  const bodyText=(g.memberIds||[]).map(id=>flat(fieldsOf(ops[byId.get(id)])?.body)).join('\n');
  const modules=moduleIds.map(id=>(p.modules||[]).find(m=>m.id===id));
  if(modules.some(m=>!m||!flat(m.paras).trim()||!flat(m.paras).split('\n').every(t=>bodyText.includes(t))))return false;
  const start=anchor.bounds[1]+anchor.bounds[3],end=Math.min(...bodyBoxes.map(b=>b[1])),boxes=[];
  for(const id of ids){
    const i=byId.get(id),image=ops[i],f=(p.supportFigures||[]).find(f=>f.operationId===id&&f.assetId===image?.assetId);
    if(!image||image.typeId!=='materials-paper-image'||!image.assetId||ownedImages.has(id)||!contains(g.bounds,image.bounds)||!f||!f.claimModuleIds?.some(id=>moduleIds.includes(id)))return false;
    const b=image.bounds;
    if(b[1]<start-3||b[1]+b[3]>end+3||b[0]+b[2]/2<anchor.bounds[0]||b[0]+b[2]/2>anchor.bounds[0]+anchor.bounds[2])return false;
    const caption=f.captionOperationId&&ops[byId.get(f.captionOperationId)];
    if(caption){
      const cb=caption._actualOperationBounds||caption.bounds;
      if(caption.typeId!=='materials-caption'||!contains(g.bounds,cb)||cb[1]<b[1]+b[3]-2||cb[1]-b[1]-b[3]>22)return false;
      boxes.push([b[0],b[1],b[2],Math.max(b[1]+b[3],cb[1]+cb[3])-b[1]]);
    }else boxes.push(b);
  }
  let cursor=start;
  for(const b of boxes.sort((a,b)=>a[1]-b[1])){if(b[1]-cursor>40)return false;cursor=Math.max(cursor,b[1]+b[3]);}
  return end-cursor<=40;
}
export function auditComposition(plan,{maxDominantShare=.55,maxRepeatedRun=2,maxCardShare,maxCardRun,actualEvidence=false}={}){
  // Evidence fields are produced only by the PPTX inspector, never by a page author.
  if(!actualEvidence)plan={...plan,pages:(plan.pages||[]).map(p=>({...p,operations:(p.operations||[]).map(o=>Object.fromEntries(Object.entries(o).filter(([k])=>!k.startsWith('_actual')&&k!=='_structureVisible')))}))};
  // Old threshold names remain readable; none can disable hard prohibitions.
  maxDominantShare=maxCardShare??maxDominantShare;maxRepeatedRun=maxCardRun??maxRepeatedRun;
  const pages=[],issues=[],excludedPages=[];
  for(const p of plan.pages||[]){
    if(specialRole(p)||libraryFixture(p)){excludedPages.push(p.id);continue;}
    if(p.role&&p.role!=='content')issues.push({code:'PAGE_ROLE_CONTENT_MISMATCH',pageId:p.id,message:'特殊页身份必须与实际对象及内容相符。'});
    const ops=p.operations||[],owners=new Map(),byId=new Map(),weights={};
    for(const [i,o]of ops.entries()){
      if(o.id){if(byId.has(o.id))issues.push({code:'DUPLICATE_OPERATION_ID',pageId:p.id,operationId:o.id});byId.set(o.id,i);}
      if(!registry.has(o.typeId))issues.push({code:'UNKNOWN_NATIVE_COMPONENT',pageId:p.id,operation:i,typeId:o.typeId});
      if(o.typeId==='materials-caption'&&(bodyWeight(o)>180||Object.values(o.textOptions||{}).some(t=>(t.font||0)>14)))issues.push({code:'CAPTION_USED_AS_BODY',pageId:p.id,operation:i});
      if(['materials-filled-column','materials-badge-panel','materials-flow-step','human-left-label-band','materials-hexagon-explanation'].includes(o.typeId)&&!length(fieldsOf(o).heading||fieldsOf(o).label))issues.push({code:'STRUCTURE_HEADING_REQUIRED',pageId:p.id,operation:i,message:'分组结构需要可见的内容标题或标签，不能用空底框充数。'});
      if(structures.has(o.typeId)&&hasVisualStructure(o)&&visibleText(o))owners.set(i,{family:treatmentOf(o.typeId),region:regionOf(o)});
    }
    const groupIds=new Set(),ownedGroupImages=new Set();
    for(const g of p.contentGroups||[]){
      const ai=byId.get(g.anchorId),anchor=ops[ai],members=(g.memberIds||[]).map(id=>byId.get(id));
      let valid=!!g.id&&!groupIds.has(g.id)&&typeof g.task==='string'&&g.task.length>0&&validBox(g.bounds)&&anchor&&anchors.has(anchor.typeId)&&hasVisualStructure(anchor)&&members.length>0&&members.every(i=>i!=null&&i!==ai)&&new Set(members).size===members.length&&contains(g.bounds,anchor.bounds);
      if(anchor?.typeId==='materials-gradient-tab')valid=valid&&length(fieldsOf(anchor).heading)>0&&contains(anchor.bounds,boxOf(anchor,'heading'));
      if(valid){
        const bs=members.map(i=>boxOf(ops[i],bodySlots(ops[i])[0]||'body'));
        for(const [j,i]of members.entries())if(!visibleText(ops[i])||!contains(g.bounds,bs[j])||!openTypes.has(ops[i].typeId)||owners.has(i))valid=false;
        if(anchor.typeId==='materials-gradient-tab'){
          const adjacent=Math.min(...bs.map(b=>b[1]))-(anchor.bounds[1]+anchor.bounds[3])<=40;
          const pictured=g.imageMemberIds?.length?figureBridgesGroup(p,g,anchor,bs,ops,byId,ownedGroupImages):false;
          valid=valid&&bs.every(b=>validBox(b)&&b[1]>=anchor.bounds[1]+anchor.bounds[3]-3&&b[0]>=anchor.bounds[0]-16)&&(g.imageMemberIds?.length?pictured:adjacent);
        }else if(g.imageMemberIds?.length)valid=false;
      }
      groupIds.add(g.id);
      if(!valid){issues.push({code:'INVALID_CONTENT_GROUP',pageId:p.id,groupId:g.id,message:'标题或括号须与实际解释绑定，位置相邻且同属声明范围；不能用装饰标签覆盖全页。'});continue;}
      for(const i of members)owners.set(i,{family:({'materials-gradient-tab':'capsule-group','materials-cycle-three':'cycle','materials-two-input-merge':'merge'})[anchor.typeId]||'brace-group',region:g.bounds});
      for(const id of g.imageMemberIds||[])ownedGroupImages.add(id);
    }
    // Semantic region ownership is checked independently of decorative frame area.
    for(const r of (p.contentRegions||[]).filter(r=>r.kind==='mixed-region').sort((a,b)=>(b.parentId?1:0)-(a.parentId?1:0))){
      const members=(r.operationIds||[]).map(id=>ops[byId.get(id)]).filter(Boolean);
      const family=members.some(o=>o.typeId==='materials-two-input-merge')?'merge':members.some(o=>o.typeId==='materials-flow-step')?'process':r.layout==='callouts'?'localized-callouts':members.some(o=>o.typeId==='materials-circle-numbered-row')?'numbered':members.some(o=>o.typeId==='materials-paper-image')?(['figure-left','figure-right'].includes(r.layout)?'paired-region':'stacked-region'):'framed-notes';
      for(const o of members){const i=byId.get(o.id);if(!owners.has(i)&&visibleText(o)&&contains(r.bounds,regionOf(o),4))owners.set(i,{family,region:r.bounds});}
    }
    // A titled native parent panel may own subordinate text geometrically inside it.
    for(const [i,o]of ops.entries())if(openTypes.has(o.typeId)&&visibleText(o)&&!owners.has(i)){
      const b=boxOf(o,bodySlots(o)[0]||'body');
      const container=[...owners].find(([j,v])=>['materials-badge-panel','materials-filled-column','human-left-label-band'].includes(ops[j].typeId)&&length(fieldsOf(ops[j]).heading||fieldsOf(ops[j]).label)>0&&contains(v.region,b)&&b[1]>=v.region[1]+42);
      if(container)owners.set(i,{...container[1]});
    }
    let structuredText=0,unstructuredText=0,bodyText=0,meaningfulFigures=0;
    for(const [i,o]of ops.entries()){
      if(decorations.has(o.typeId)||commonThesis(o)||o.semanticRole==='lane-label')continue;
      if(o.typeId==='materials-paper-image'&&o.assetId&&area(o.bounds)>=12000&&Math.min(o.bounds[2],o.bounds[3])>=64)meaningfulFigures++;
      const w=bodyWeight(o);if(!w)continue;bodyText+=w;const own=owners.get(i);
      if(own){
        if(bodySlots(o).some(s=>length(fieldsOf(o)[s])&&!contains(own.region,boxOf(o,s))))issues.push({code:'STRUCTURED_TEXT_OUTSIDE_COMPONENT',pageId:p.id,operation:i});
        structuredText+=w;weights[own.family]=(weights[own.family]||0)+w;
      }else if(bands.has(o.typeId)&&[...owners.keys()].some(j=>structures.has(ops[j].typeId))){
        structuredText+=w;
        weights['shared-conclusion']=(weights['shared-conclusion']||0)+w;
      }else{
        unstructuredText+=w;weights[treatmentOf(o.typeId)]=(weights[treatmentOf(o.typeId)]||0)+w;
        issues.push({code:'UNSTRUCTURED_BODY_TEXT',pageId:p.id,operation:i,typeId:o.typeId,message:'正文解释须归属原生分栏、标签面板、关系结构或有效标题组；散排文字和裸列表不能独立布局。'});
      }
    }
    if(unstructuredText&&structuredText===0)issues.push({code:'PURE_TEXT_BODY_FORBIDDEN',pageId:p.id,message:'正文只有散排文字或裸列表；公共页头、总点、图片和装饰不构成正文分组。'});
    if(!structuredText&&!meaningfulFigures)issues.push({code:'MEANINGFUL_BODY_STRUCTURE_REQUIRED',pageId:p.id,message:'缺少实际承载正文或证据的结构。'});
    issues.push(...numericIssues(p,ops));
    const ranked=Object.entries(weights).filter(([f,w])=>w>0&&f!=='shared-conclusion').sort((a,b)=>b[1]-a[1]);
    pages.push({pageId:p.id,title:p.title,dominant:ranked[0]?.[0]||'evidence-image',treatments:ranked.map(([f])=>f),
      bodyTextWeights:weights,bodyText,structuredText,unstructuredText,structuredTextShare:bodyText?structuredText/bodyText:0,meaningfulFigures,
      blueTopCardShare:bodyText?(weights['blue-top-card']||0)/bodyText:0,sourceTypes:[...new Set(ops.map(o=>o.typeId))],
      topology:structureSignature(p).fingerprint,regional:(p.contentRegions||[]).some(r=>r.kind==='mixed-region'),sourceIds:p.sourceIds||[],series:p.compositionSeries||null,rationale:p.compositionRationale||null});
  }
  let run=[];
  const flush=()=>{if(run.length>maxRepeatedRun&&!seriesReviewed(run)&&!(run.some(r=>r.regional)&&new Set(run.map(r=>r.topology)).size>1))issues.push({code:'REPEATED_BODY_TREATMENT',family:run[0].dominant,pages:run.map(p=>p.pageId),message:'连续正文结构重复；同一证据系列需提供对应页与来源的 compositionSeries，泛化理由不能豁免。'});run=[];};
  for(const p of pages){if(run.length&&p.dominant!==run[0].dominant)flush();run.push(p);}flush();
  const counts={};for(const p of pages)counts[p.dominant]=(counts[p.dominant]||0)+1;
  if(pages.length>=8)for(const [family,n]of Object.entries(counts))if(n/pages.length>maxDominantShare&&!seriesReviewed(pages.filter(p=>p.dominant===family)))issues.push({code:'BODY_TREATMENT_DOMINATES_DECK',family,share:n/pages.length,pages:pages.filter(p=>p.dominant===family).map(p=>p.pageId),message:'同一主体结构占比过高；按内容复核，不随机改色或改布局名凑数量。'});
  const cardDominant=counts['blue-top-card']||0;
  const spatial=auditSpatialLayout({pages:(plan.pages||[]).filter(p=>pages.some(row=>row.pageId===p.id))},{actualEvidence});
  issues.push(...spatial.issues);
  const visual=auditVisualPlan(plan,{actualEvidence});issues.push(...visual.issues);
  const frames=auditFigureFrames(plan,{actualEvidence});issues.push(...frames.issues);
  const diversity=auditLayoutDiversity(plan,{bodyRows:pages});issues.push(...diversity.issues);
  const relationships=auditRelationshipEvidence(plan);issues.push(...relationships.issues);
  const regions=auditRegions(plan,{actualEvidence});issues.push(...regions.issues);
  const componentPolish=auditComponentPolish(plan,{actualEvidence});issues.push(...componentPolish.issues);
  const referenceLayouts=auditReferenceLayouts(plan,{actualEvidence});issues.push(...referenceLayouts.issues);
  return {policyVersion:7,pass:issues.length===0,basis:'Actual body operations, bound groups, claim-bound figure bridges, geometry and numeric font sizes; rationale and version fields cannot waive prohibitions.',
    contentPages:pages.length,excludedPages,blueTopCardDominantPages:cardDominant,blueTopCardDominantShare:pages.length?cardDominant/pages.length:0,
    bodyTreatmentCounts:counts,bodyTreatments:[...new Set(pages.flatMap(p=>p.treatments))],spatial,visual,frames,diversity,relationships,regions,componentPolish,referenceLayouts,issues,pages};
}
