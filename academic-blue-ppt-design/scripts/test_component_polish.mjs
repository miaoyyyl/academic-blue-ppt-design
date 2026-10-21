import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderComponent} from '../assets/native-components/api.mjs';
import {compileComposition} from '../assets/composition-layout.mjs';
import {inspectAudienceText} from '../assets/audience-copy.mjs';
const out=path.resolve(process.argv[2]||'qa/component-polish');fs.mkdirSync(out,{recursive:true});
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,message:e.message});}}
async function native(typeId,bounds,content){const slide={nativeOperations:[]},r=await renderComponent({typeId,bounds,content,slide});assert(r.ok,JSON.stringify(r));return slide.nativeOperations[0];}
await check('table defaults to explicit uniform white appearance',async()=>{const o=await native('human-comparison-table',[44,120,1190,500],{fields:{cell0_0:'项目',cell1_0:'中性对象'}});assert.equal(o.tableAppearance,'uniform-white-blue');});
await check('merge slots center in both directions',async()=>{const o=await native('materials-two-input-merge',[100,180,1040,152],{fields:{input0:'条件甲',input1:'条件乙',result:'共同结果'}});for(const s of ['input0','input1','result']){assert.equal(o.textOptions[s].align,'ctr');assert.equal(o.textOptions[s].vAlign,'ctr');}});
await check('short result and inputs do not span the entire allocation',async()=>{const o=await native('materials-two-input-merge',[100,180,1040,152],{fields:{input0:'条件甲',input1:'条件乙',result:'共同结果'}});assert(o.objectBoxes['111'][2]<520);assert(o.objectBoxes['107'][2]<300);});
const groups=[{id:'a',heading:'作用机制',paras:['说明本次输入对应的对象与条件。'],sourceIds:['s1'],visualIntent:'context'},{id:'b',heading:'实施方法',paras:['根据条件确定操作，并核对相应结果。'],sourceIds:['s1'],visualIntent:'context'}];
await check('folded region title is attached outside its own frame',()=>{const r=compileComposition({compositionId:'mixed-evidence-regions',pageId:'fold',relation:'parallel',groups,figures:[],bounds:[44,110,1192,547],regions:groups.map((g,i)=>({id:g.id,heading:g.heading,purpose:g.heading,moduleIds:[g.id],figureIds:[],rect:[i*.52,0,.48,.8],kind:'notes',headingStyle:'folded'}))});assert(r.ok,JSON.stringify(r.errors));const h=r.operations.find(o=>o.typeId==='materials-folded-tab'),f=r.operations.find(o=>o.regionContainer?.regionId===h.regionId);assert(h.bounds[0]<f.bounds[0]);assert(h.bounds[3]>50);});
await check('source and acceptance process copy is rejected',()=>{for(const t of ['工程案例配图与参数沿用专题材料，具体适用性取决于场地条件','案例材料所述示范点结果；未附原始监测表，不外推至全部场地','案例资料口径：土壤变化、长期性、成本及推广规模均待原始资料进一步核验'])assert(inspectAudienceText(t).length>0,t);});
await check('sourceLabel remains metadata and produces no slide footer',()=>{
 const detail=groups.map(g=>({...g,paras:['先界定对象、输入条件和判断标准，再说明每项条件对结果的影响。比较时保持相同指标、时间范围与适用条件，避免将不同对象直接合并。','操作分为准备、执行和核对三个阶段，记录每一步的依据及结果。出现条件变化时重新判断适用性，并保留可以追溯的输入与结论。']}));
 const p={chapters:[{id:'c1',title:'中性章节'}],pages:[{id:'p1',role:'content',chapterId:'c1',title:'对象与条件共同支撑判断',thesis:'对象与条件共同支撑判断',relation:'parallel',sourceIds:['s1'],compositionId:'mixed-evidence-regions',compositionRationale:'两个对象共享一个判断，分区保留条件。',modules:detail,supportFigures:[],sourceLabel:'中性报告名',regions:detail.map((g,i)=>({id:g.id,heading:g.heading,purpose:g.heading,moduleIds:[g.id],figureIds:[],rect:[i*.52,.3,.48,.7],kind:'notes'}))}]};
 const input=path.join(out,'footer-input.json'),output=path.join(out,'footer-output.json');fs.writeFileSync(input,JSON.stringify(p));
 const r=spawnSync(process.execPath,[fileURLToPath(new URL('./plan_native_layout.mjs',import.meta.url)),input,output],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const plan=JSON.parse(fs.readFileSync(output));assert(!plan.pages[0].operations.some(o=>o.typeId==='materials-caption'&&o.bounds[1]>660));
});
const report={pass:checks.every(c=>c.pass),checks};fs.writeFileSync(path.join(out,'component-polish.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
