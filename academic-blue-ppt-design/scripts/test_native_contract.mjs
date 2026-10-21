import fs from 'node:fs';
import assert from 'node:assert/strict';
import {findCases,renderComponent} from '../assets/native-components/api.mjs';
const checks=[];
function check(name,fn){fn();checks.push({name,pass:true});}
const types=findCases();
check('only sourced native prototypes',()=>assert(types.length>=12&&new Set(types.map(t=>t.typeId)).size===types.length&&types.every(t=>/^(materials|by_human)\//.test(t.sourceFile)&&t.sourceFileSha256.length===64&&t.sourceObjectIds.length&&t.nativeOnly&&t.noGeometryFallback)));
const base={typeId:'materials-filled-column',bounds:[40,170,380,320],content:{fields:{heading:'中性栏目',body:['依据来自本次输入。']}}};
for(const [name,change]of [
 ['retired simplified ID',{typeId:'parallel-columns-2'}],
 ['unknown field',{content:{fields:{notASlot:'禁止静默忽略'}}}],
 ['out of canvas',{bounds:[1200,100,380,320]}],
 ['negative size',{bounds:[40,170,-1,320]}],
 ['missing image',{typeId:'materials-paper-image',content:{fields:{}}}],
 ['invalid image alignment',{content:{fields:{heading:'中性栏目'},imageAlign:'stretch'}}],
 ['invalid text anchor',{content:{fields:{heading:'中性栏目'},textOptions:{heading:{vAlign:'auto'}}}}],
 ['invented bullet',{content:{fields:{body:'说明'},textOptions:{body:{bullet:'random'}}}}],
 ['missing native bullet',{content:{fields:{body:'说明'},textOptions:{body:{bullet:'source'}}}}],
 ['unknown emphasis token',{content:{fields:{body:'本次依据'},textOptions:{body:{emphasis:[{text:'不存在'}]}}}}],
]){
 const slide={nativeOperations:[]};const result=await renderComponent({...base,...change,slide});
 check(name+' rejected without partial commit',()=>assert(!result.ok&&slide.nativeOperations.length===0));
}
const slide={nativeOperations:[]};const result=await renderComponent({...base,slide});
check('native operation records exact source binding',()=>assert(result.ok&&result.pendingCommit&&slide.nativeOperations.length===1&&result.bindings.every(b=>b.sourceFile.startsWith('materials/'))));
const file=process.argv[2];if(file)fs.writeFileSync(file,JSON.stringify({pass:true,checks},null,2));
console.log(JSON.stringify({pass:true,checks:checks.length}));
