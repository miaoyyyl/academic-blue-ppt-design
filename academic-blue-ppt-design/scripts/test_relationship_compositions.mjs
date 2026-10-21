import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as layouts from '../assets/composition-layout.mjs';
const g=(id,role='peer')=>({id,heading:'对象'+id,paras:['材料明确说明该对象的作用与条件。'],sourceIds:['p-1'],visualIntent:'context',role});
const pic=ids=>({id:'figure',assetId:'asset',figureType:'scene',figureRole:'context',claimModuleIds:ids,dimensions:[1200,800],captionPolicy:'none',readingTargets:[{name:'对应场景',task:'recognize',rect:[0,0,1,1]}]});
const groups=['a','b','c'].map(id=>g(id));
const test=(name,run)=>{try{run();return{name,pass:true};}catch(e){return{name,pass:false,message:e.message};}};
const cases=[];
for(const[id,relation,modules,options]of[
 ['timeline-with-evidence','temporal',groups.map((v,i)=>({...v,date:'202'+i})),{relationEvidence:{sourceIds:['p-1'],kind:'temporal'}}],
 ['numbered-with-evidence','unordered',groups,{}],
 ['classified-with-evidence','classification',groups,{}],
 ['merge-with-evidence','merge',[g('a','input'),g('b','input'),g('c','result')],{relationEvidence:{sourceIds:['p-1'],kind:'merge'}}],
 ['branch-with-evidence','total-detail',[g('a','core'),g('b','detail'),g('c','detail')],{}],
 ['cycle-with-evidence','cycle',groups,{center:'回用',relationEvidence:{sourceIds:['p-1'],kind:'cycle',edges:[['a','b'],['b','c'],['c','a']]}}],
 ['matrix-with-evidence','comparison',['a','b','c','d','e'].map(id=>({...g(id),paras:['主体','历史数值','年份','统计边界']})),{matrixHeaders:['渠道','主体','数值','年份','条件']}],
 ['response-with-evidence','problem-response',[g('a'),g('b')].map(v=>({...v,paras:['有依据的问题。','针对该问题的建议。']})),{}]
])cases.push(test(id+' accepts a claim-bound photograph',()=>{const r=layouts.compileComposition({compositionId:id,relation,groups:modules,figures:[pic(modules.map(m=>m.id))],options});assert.equal(r.ok,true,JSON.stringify(r.errors));assert.ok(r.operations.some(o=>o.typeId==='materials-paper-image'));}));
cases.push(test('missing cycle evidence is rejected',()=>{const r=layouts.compileComposition({compositionId:'cycle-with-evidence',relation:'cycle',groups,figures:[pic(groups.map(g=>g.id))]});assert.equal(r.errors[0]?.code,'RELATION_EVIDENCE_REQUIRED');}));
cases.push(test('parallel items cannot become a cycle',()=>{const r=layouts.compileComposition({compositionId:'cycle-with-evidence',relation:'parallel',groups,figures:[pic(groups.map(g=>g.id))]});assert.equal(r.errors[0]?.code,'COMPOSITION_RELATION_MISMATCH');}));
cases.push(test('an open path cannot become a closed loop',()=>{const r=layouts.compileComposition({compositionId:'cycle-with-evidence',relation:'cycle',groups,figures:[pic(groups.map(g=>g.id))],options:{relationEvidence:{sourceIds:['p-1'],kind:'cycle',edges:[['a','b'],['b','c']]}}});assert.equal(r.errors[0]?.code,'CYCLE_EDGES_NOT_CLOSED');}));
cases.push(test('previously selected layout does not receive self-confirming score',()=>{const req={relation:'parallel',groups:groups.slice(0,2),figures:[pic(['a','b'])]};const a=layouts.recommendCompositions(req),b=layouts.recommendCompositions({...req,preferredCompositionId:a.candidates[0].compositionId});assert.deepEqual(a.candidates.map(c=>[c.compositionId,c.score]),b.candidates.map(c=>[c.compositionId,c.score]));}));
cases.push(test('auto selection chooses a certified candidate',()=>{assert.equal(typeof layouts.chooseComposition,'function');const r=layouts.chooseComposition({relation:'classification',groups,figures:[pic(groups.map(g=>g.id))]});assert.equal(r.selected,'classified-with-evidence');}));
const report={pass:cases.every(c=>c.pass),cases};
const file=process.argv[2];if(file)fs.writeFileSync(file,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=2;
