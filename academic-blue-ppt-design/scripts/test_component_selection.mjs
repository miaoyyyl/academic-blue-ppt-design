import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recommendComponents,auditComposition} from '../assets/component-selection.mjs';
import {renderComponent} from '../assets/native-components/api.mjs';
// Legacy structure tests intentionally omit semantic planning metadata.
const structureAudit=plan=>{const r=auditComposition(plan);const issues=r.issues.filter(i=>!r.visual.issues.includes(i));return {...r,issues,pass:!issues.length};};
const checks=[];function check(name,fn){fn();checks.push({name,pass:true});}
check('unordered forms have source symbols and no implied ranking',()=>{
 const r=recommendComponents({task:'classification',relation:'unordered',itemCount:5});
 assert(r.ok&&r.cases[0].typeId==='human-square-notes'&&!r.cases.some(c=>c.typeId.includes('numbered')));
});
check('time cannot be disguised as unordered notes',()=>assert(!recommendComponents({task:'classification',relation:'temporal',itemCount:3}).ok));
check('causal arrows cannot be replaced with paragraph arrows',()=>assert(!recommendComponents({task:'mechanism-notes',relation:'causal',itemCount:3}).ok));
check('three dates select original native timeline',()=>assert(recommendComponents({task:'timeline',relation:'temporal',itemCount:3}).cases[0].typeId==='materials-timeline-three'));
check('four milestones select added source timeline; unsupported count still fails',()=>{assert.equal(recommendComponents({task:'timeline',relation:'temporal',itemCount:4}).cases[0].typeId,'materials-timeline-four');assert(!recommendComponents({task:'timeline',relation:'temporal',itemCount:5}).ok);});
check('merge count fails explicitly',()=>assert(!recommendComponents({task:'two-input-merge',relation:'causal',itemCount:3}).ok));
check('unreported result cannot acquire check marks',()=>assert(!recommendComponents({task:'reported-results',itemCount:2}).ok));
check('future directions use neutral squares',()=>assert(recommendComponents({task:'research-directions',evidenceStatus:'proposed',itemCount:3}).cases[0].typeId==='human-square-notes'));
check('unsupported content has no rectangle fallback',()=>assert(!recommendComponents({task:'invented'}).ok));
const s={nativeOperations:[]};
const result=await renderComponent({typeId:'human-square-notes',slide:s,bounds:[40,180,1200,400],content:{fields:{body:['条件：说明边界。']},textOptions:{body:{emphasis:[{text:'边界',color:'C00000'}]}}}});
check('source symbols and emphasis survive operation recording',()=>assert(result.ok&&s.nativeOperations[0].textOptions.body.bullet==='source'&&s.nativeOperations[0].textOptions.body.emphasis.length===1));
const empty={nativeOperations:[]};await renderComponent({typeId:'human-square-notes',slide:empty,bounds:[40,180,1200,400]});
check('optional omitted body clears all inherited markers',()=>assert.deepEqual(empty.nativeOperations[0].fields.body,[]));
const make=(i,typeId='materials-filled-column')=>({id:'p'+i,role:'content',sourceIds:['s1'],layoutFamily:'invented-name-'+i,operations:[{typeId:'materials-frame',bounds:[0,0,1280,77],fields:{title:'公共页头'}},{typeId:'human-gradient-statement',bounds:[40,98,1200,62],fields:{body:'公共总点'}},{typeId,bounds:[40,180,1200,450],fields:{heading:'条件解释',label:'条件解释',body:'正文条件与证据的解释。'.repeat(20)}}]});
check('layout names cannot conceal repeated cards',()=>assert(!auditComposition({pages:[make(1),make(2),make(3)]}).pass));
check('common frame and thesis do not create a false body repetition',()=>assert(structureAudit({pages:[make(1,'materials-filled-column'),make(2,'human-left-label-band'),make(3,'materials-outline-condition')]}).pass));
check('generic rationale cannot waive a repeated composition',()=>assert(!auditComposition({pages:[1,2,3].map(i=>({...make(i),compositionRationale:'同一实验的三个条件对照，同一变量与槽位需保持一致。'}))}).pass));
check('scientific series has explicit page and source review',()=>assert(structureAudit({pages:[1,2,3].map(i=>({...make(i),compositionSeries:{id:'same-experiment',reason:'同一实验中的三个条件对照需要同样的变量与槽位。',pageIds:['p1','p2','p3'],sourceIds:['s1']}}))}).pass));
const report={pass:true,checks};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,checks:checks.length}));
