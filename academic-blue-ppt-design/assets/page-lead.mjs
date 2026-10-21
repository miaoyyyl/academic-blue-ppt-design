/** A planning thesis need not consume a second visible headline. Native objects only. */
import {normalizeSummaryCopy} from './summary-copy.mjs';
const legacy=new Set(['human-gradient-statement','materials-statement-band','materials-gradient-conclusion']);
const supported=new Set([...legacy,'materials-gradient-tab','materials-outline-condition','materials-outline-lead']);
export const claimSlot=o=>o.typeId==='materials-gradient-tab'?'heading':'body';
export const isPageClaim=o=>supported.has(o.typeId)&&o.bounds?.[1]<175&&o.bounds?.[3]<=90&&(o.semanticRole==='page-lead'||legacy.has(o.typeId));
export const contentBoundsFor=page=>page.compositionBounds||(page.lead?.mode==='none'?[44,110,1192,547]:[44,177,1192,480]);
export function createPageLead(page){
 const lead=page.lead;
 if(!lead||lead.mode==='none')return null;
 const text=normalizeSummaryCopy(lead?.text||page.thesis),kind=lead?.component||'gradient';
 const b=[44,100,1192,58],bb=[60,108,1160,42];
 const basic={id:page.id+'-thesis',semanticRole:'page-lead',componentTask:'key-claim',bounds:b};
 const opt={box:bb,font:21,color:'004BAD',bold:true,align:'ctr',vAlign:'ctr',leading:101,inset:0};
 if(kind==='capsule')return {...basic,typeId:'materials-gradient-tab',fields:{heading:text},textOptions:{heading:{...opt,color:'FFFFFF'}},objectBoxes:{'33':b}};
 if(kind==='outline')return {...basic,typeId:'materials-outline-condition',fields:{body:text},textOptions:{body:opt},objectBoxes:{'90':b,'91':bb}};
 if(kind==='native-outline')return {...basic,typeId:'materials-outline-lead',fields:{body:text},textOptions:{body:opt},objectBoxes:{'12':b,'13':bb}};
 if(kind==='plain')return {...basic,typeId:'materials-statement-band',fields:{body:text},textOptions:{body:opt},objectBoxes:{'11':b,'12':bb}};
 if(kind!=='gradient')throw Error('PAGE_LEAD_COMPONENT_UNSUPPORTED');
 return {...basic,typeId:'human-gradient-statement',fields:{body:text},textOptions:{body:opt},objectBoxes:{'49':b}};
}
export function auditPageLeads(plan,{actualEvidence=false}={}){
 const issues=[],pages=[];
 for(const p of plan.pages||[]){
  if(p.role!=='content')continue;
  const leads=(p.operations||[]).filter(isPageClaim),lead=p.lead,add=code=>issues.push({code,pageId:p.id});
  if(plan.leadPolicy?.version===1&&!lead)add('PAGE_LEAD_DECISION_REQUIRED');
  if(lead){
   if(!['none','shared','transition'].includes(lead.mode))add('PAGE_LEAD_MODE_INVALID');
   if(lead.mode==='none'&&leads.length)add('OMITTED_LEAD_STILL_RENDERED');
   if(lead.mode!=='none'){
    const ids=new Set((p.modules||[]).map(m=>m.id));
    if(leads.length!==1||!lead.reason?.trim())add('PAGE_LEAD_ROLE_REQUIRED');
    if(lead.mode==='shared'&&(!lead.covers||new Set(lead.covers).size<2||lead.covers.some(id=>!ids.has(id))))add('SHARED_LEAD_MODULE_BINDING_REQUIRED');
    const value=normalizeSummaryCopy(lead.text||p.thesis),title=normalizeSummaryCopy(p.title);
    if(value===title||value.includes(title)&&value.length<title.length+8)add('PAGE_LEAD_DUPLICATES_TITLE');
    for(const o of leads){const slot=claimSlot(o),v=actualEvidence?o._actualFields?.[slot]:o.fields?.[slot];if(normalizeSummaryCopy(Array.isArray(v)?v.join(''):v)!==value)add('PAGE_LEAD_VISIBLE_TEXT_MISMATCH');}
   }
   if(lead.mode==='none'&&contentBoundsFor(p)[1]>125)add('OMITTED_LEAD_SPACE_NOT_RECLAIMED');
  }
  pages.push({pageId:p.id,mode:lead?.mode||'legacy',component:lead?.component||null,visibleLeadCount:leads.length});
 }
 return {pass:!issues.length,issues,pages};
}
