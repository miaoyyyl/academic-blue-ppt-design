import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileComposition} from '../assets/composition-layout.mjs';
import {createPageLead,auditPageLeads,contentBoundsFor,claimSlot} from '../assets/page-lead.mjs';
import {auditSpatialLayout,moveLayout} from '../assets/spatial-layout.mjs';
import {alignPairedRegions,auditPairedRegions} from '../assets/paired-layout.mjs';
import {auditComposition} from '../assets/composition-policy.mjs';
const cases=[];const test=(name,run)=>{try{run();cases.push({name,pass:true});}catch(e){cases.push({name,pass:false,message:e.message});}};
const g=(id,role='peer')=>({id,heading:'环节'+id,paras:['设备与条件共同影响过程。'],visualIntent:'application',sourceIds:['s'],role});
const f=(id,ids)=>({id,assetId:id,dimensions:[1000,750],figureType:'scene',figureRole:'context',claimModuleIds:ids,captionPolicy:'none',readingTargets:[{name:'对应设备',task:'recognize',rect:[0,0,1,1]}]});
for(const side of ['left','right'])test('paired figure '+side+' shares both measured edges',()=>{
 const c=compileComposition({pageId:'p',compositionId:'figure-with-explanations',groups:[g('a'),g('b')],figures:[f('f',['a','b'])],relation:'parallel',options:{figurePosition:side,textWidth:460}});assert(c.ok,JSON.stringify(c.errors));
 const p={id:'p',role:'content',...c};assert(auditPairedRegions(p).pass);
 const q=structuredClone(p),id=q.pairedRegions[0].groups[0].operationIds;moveLayout(q,id,0,40);assert(!auditPairedRegions(q).pass);
});
test('actual glyph extent overrides reserved text box for bottom alignment',()=>{
 const c=compileComposition({pageId:'p',compositionId:'figure-with-explanations',groups:[g('a'),g('b')],figures:[f('f',['a','b'])],relation:'parallel'});assert(c.ok);
 for(const o of c.operations)if(o.typeId==='materials-text'){const b=o.textOptions.body.box;o._renderedSlotBounds={body:[b[0],b[1],b[2],24]};}
 alignPairedRegions(c,{actual:true,move:moveLayout});assert(auditPairedRegions(c,{actualEvidence:true}).pass);
});
test('direct operations cannot bypass known paired composition checks by dropping bindings',()=>{
 const c=compileComposition({pageId:'p',compositionId:'figure-with-explanations',groups:[g('a'),g('b')],figures:[f('f',['a','b'])],relation:'parallel'});assert(c.ok);delete c.pairedRegions;
 const result=auditPairedRegions(c);assert(result.issues.some(i=>i.code==='PAIRED_LAYOUT_BINDING_REQUIRED'));
});
for(const kind of ['gradient','plain','capsule','outline'])test('native lead '+kind+' retains semantic role and centering',()=>{
 const p={id:'p',role:'content',title:'路线比较',modules:[g('a'),g('b')],lead:{mode:'shared',text:'共同条件影响两条技术路线',component:kind,covers:['a','b'],reason:'共同比较依据'}};p.operations=[createPageLead(p)];assert(auditPageLeads({pages:[p]}).pass);assert.equal(p.operations[0].textOptions[claimSlot(p.operations[0])].align,'ctr');
});
test('omitted lead reclaims space and adds no object',()=>{const p={lead:{mode:'none'}};assert.equal(createPageLead(p),null);assert(contentBoundsFor(p)[1]<=125);});
test('a redundant title repeated in a lead is rejected',()=>{const p={id:'p',role:'content',title:'路线比较',modules:[g('a'),g('b')],lead:{mode:'shared',text:'路线比较',component:'plain',covers:['a','b'],reason:'比较'}};p.operations=[createPageLead(p)];assert(!auditPageLeads({pages:[p]}).pass);});
test('a photograph does not clear an independently sparse process lane',()=>{
 const c=compileComposition({compositionId:'process-with-evidence',pageId:'p',groups:[g('a','step'),g('b','step'),g('c','step')],figures:[f('f',['a'])],relation:'process',options:{figurePosition:'right',processWidth:760}});assert(c.ok);
 const a=auditSpatialLayout({pages:[{id:'p',role:'content',...c}]});assert(a.issues.some(i=>i.code==='LOCAL_REGION_CONTENT_TOO_SPARSE'));
});
test('each process column owns a distinct corresponding figure',()=>{
 const groups=['a','b','c'].map(id=>g(id,'step')),q={compositionId:'stages-with-local-figures',pageId:'p',groups,figures:groups.map(v=>f('f-'+v.id,[v.id])),relation:'process'};
 const c=compileComposition(q);assert(c.ok,JSON.stringify(c.errors));assert.equal(c.contentRegions.length,3);assert.equal(c.operations.filter(o=>o.typeId==='materials-flow-step').length,3);
 const bad=compileComposition({...q,figures:[...q.figures.slice(0,2),f('wrong',['a'])]});assert(!bad.ok);
});
test('branch explanations, brace and core use the same picture extent',()=>{
 const groups=[g('a','core'),g('b','detail'),g('c','detail')],c=compileComposition({compositionId:'branch-with-evidence',pageId:'p',groups,figures:[f('f',['a','b','c'])],relation:'total-detail'});assert(c.ok,JSON.stringify(c.errors));assert(auditPairedRegions(c).pass);const pair=c.pairedRegions[0],frame=c.operations.find(o=>o.id===pair.frameOperationId),brace=c.operations.find(o=>o.id===pair.decorationIds[0]);assert(Math.abs(frame.bounds[1]-brace.bounds[1])<1);assert(Math.abs(frame.bounds[3]-brace.bounds[3])<1);
});
test('merge explanations are a single native unordered group below aligned top regions',()=>{
 const groups=[g('a','input'),g('b','input'),g('c','result')],c=compileComposition({compositionId:'merge-with-evidence',pageId:'p',groups,figures:[f('f',['a'])],relation:'merge',options:{relationEvidence:{kind:'merge',sourceIds:['s']}}});assert(c.ok,JSON.stringify(c.errors));
 const note=c.operations.find(o=>o.typeId==='human-dot-notes'),merge=c.operations.find(o=>o.typeId==='materials-two-input-merge');assert(note);assert.equal(note.fields.body.length,3);assert(note.bounds[1]>merge.bounds[1]+merge.bounds[3]);assert(note.bounds[2]>1000);
 assert(auditPairedRegions(c).pass);const frame=c.operations.find(o=>o.id===c.pairedRegions[0].frameOperationId);assert(Math.abs(frame.bounds[1]-merge.bounds[1])<=8);assert(Math.abs(frame.bounds[1]+frame.bounds[3]-merge.bounds[1]-merge.bounds[3])<=26);
 const a=auditComposition({pages:[{id:'p',role:'content',relation:'merge',sourceIds:['s'],modules:groups,compositionOptions:{relationEvidence:{kind:'merge',sourceIds:['s']}},...c}]});assert(!a.issues.some(i=>i.code==='UNSTRUCTURED_BODY_TEXT'),JSON.stringify(a.issues));
});
const report={pass:cases.every(c=>c.pass),cases};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=2;
