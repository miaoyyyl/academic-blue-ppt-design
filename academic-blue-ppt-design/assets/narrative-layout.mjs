/** Placement and labels, without drawing replacement geometry. */
import {isPageClaim,claimSlot} from './page-lead.mjs';
import {applyNavigationPolicy} from './navigation-layout.mjs';
import {normalizeSummaryCopy} from './summary-copy.mjs';
export function sectionLabels(plan){
 const labels=new Map();
 for(const [i,ch]of(plan.chapters||[]).entries()){
  const pages=plan.pages.filter(p=>p.role==='content'&&p.chapterId===ch.id);
  const keys=[...new Set(pages.map(p=>p.subsectionId||p.id))];
  for(const p of pages){const j=keys.indexOf(p.subsectionId||p.id)+1;labels.set(p.id,{chapterNumber:i+1,subsectionNumber:keys.length>1?j:null,label:keys.length>1?`${i+1}.${j}`:String(i+1)});}
 }
 for(const p of plan.pages)if(p.role==='content'&&!labels.has(p.id))throw Error('CONTENT_CHAPTER_REQUIRED: '+p.id);
 return labels;
}
export function textHeight(paragraphs,width,fontPt=17,{leading=108,padding=4}={}){
 if(!(width>0&&fontPt>0))throw Error('TEXT_MEASURE_BOUNDS_INVALID');
 const list=Array.isArray(paragraphs)?paragraphs:[paragraphs];let lines=0;
 for(const v of list)for(const s of String(v??'').split('\n')){
  const units=[...s].reduce((n,c)=>n+(/[\u2E80-\u9FFF\uFF00-\uFFEF]/u.test(c)?1:/[A-Z0-9]/.test(c)?0.63:0.52),0);
  lines+=Math.max(1,Math.ceil(units*fontPt*4/3/width));
 }
 return Math.ceil(lines*fontPt*4/3*leading/100+Math.max(0,list.length-1)*2+padding);
}
export function contentPanelHeight(paragraphs,width,fontPt=17,{header=54,minHeight=96,maxHeight=540,leading=108}={}){
 const need=header+textHeight(paragraphs,width-28,fontPt,{leading})+14;
 if(need>maxHeight)throw Error(`PANEL_CAPACITY_EXCEEDED: needs ${need}px, available ${maxHeight}px; reorganize or split`);
 return Math.max(minHeight,need);
}
export function applyNarrativePolicy(input){
 const plan=structuredClone(input),labels=sectionLabels(plan);
 plan.layoutPolicy={...(plan.layoutPolicy||{}),version:3,componentSelectionVersion:6,headerNumbering:'chapter-subsection',bodyAlignment:'left-top',groupPlacement:'auto',heightPolicy:'content-first',shapeSource:'authorized-source-native-only'};
 for(const p of plan.pages){
  if(p.role!=='content')continue;
  for(const key of ['thesis','visibleArgument'])if(p[key]!=null)p[key]=normalizeSummaryCopy(p[key]);
  const n=labels.get(p.id);p.sectionLabel=n.label;p.chapterNumber=n.chapterNumber;p.subsectionNumber=n.subsectionNumber;
  for(const o of p.operations||[]){
   if(isPageClaim(o)&&o.fields?.[claimSlot(o)]!=null){
    o.fields[claimSlot(o)]=normalizeSummaryCopy(o.fields[claimSlot(o)]);
    for(const route of p.contentRouting||[])if(route.target?.operationId===o.id&&route.target?.slot===claimSlot(o)&&route.visibleText!=null)route.visibleText=normalizeSummaryCopy(route.visibleText);
   }
   if(o.typeId==='materials-frame'){o.fields={...o.fields,number:n.label};if(o.textOptions?.number)o.textOptions.number.vAlign='ctr';}
   for(const [slot,opt]of Object.entries(o.textOptions||{}))if(slot==='body'||isPageClaim(o)&&slot===claimSlot(o))opt.align=isPageClaim(o)||['lane-label','region-conclusion'].includes(o.semanticRole)?'ctr':'l';
  }
 }
 return applyNavigationPolicy(plan);
}
export function validateNarrativePolicy(plan){
 const expected=sectionLabels(plan),errors=[],warnings=[];
 for(const p of plan.pages){
  if(p.role!=='content')continue;
  const label=expected.get(p.id).label;
  for(const o of p.operations||[]){
   if(o.typeId==='materials-frame'&&o.fields?.number!==label)errors.push({code:'HEADER_IS_NOT_CHAPTER_SUBSECTION',pageId:p.id,expected:label});
   if(!isPageClaim(o)&&!['lane-label','region-conclusion'].includes(o.semanticRole)&&o.textOptions?.body?.align==='ctr')errors.push({code:'BODY_CENTER_ALIGNMENT',pageId:p.id,operationId:o.id});
  }
  if(!p.layoutFamily)warnings.push({code:'PAGE_LAYOUT_FAMILY_UNRECORDED',pageId:p.id});
 }
 const families=[...new Set(plan.pages.filter(p=>p.role==='content').map(p=>p.layoutFamily).filter(Boolean))];
 if(plan.pages.filter(p=>p.role==='content').length>=8&&families.length<3)warnings.push({code:'REVIEW_LAYOUT_MONOTONY',families});
 return {pass:!errors.length,errors,warnings,families};
}
