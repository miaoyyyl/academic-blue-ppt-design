/** Adjust a copied plan using the measured glyph bounds; never change words or font sizes. */
import fs from 'node:fs';
import {attachRenderedGeometry,alignPairedRegions} from '../assets/paired-layout.mjs';
import {moveLayout} from '../assets/spatial-layout.mjs';
const[input,bindingFile,renderFile,output,receipt]=process.argv.slice(2);
if(!receipt)throw Error('Usage: refine_rendered_alignment.mjs plan bindings render output receipt');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),inputPlan=read(input),actual=attachRenderedGeometry(inputPlan,read(bindingFile),read(renderFile));
if(actual.issues.length)throw Error(JSON.stringify(actual.issues));
const changes=[];
for(const p of actual.plan.pages){
 if(!p.pairedRegions?.length)continue;
 const moved=alignPairedRegions(p,{actual:true,move:moveLayout});changes.push(...moved.map(c=>({pageId:p.id,...c})));
}
for(const p of actual.plan.pages)for(const o of p.operations||[])for(const k of Object.keys(o))if(k.startsWith('_actual')||k.startsWith('_rendered'))delete o[k];
fs.writeFileSync(output,JSON.stringify(actual.plan,null,2));fs.writeFileSync(receipt,JSON.stringify({basis:'measured PowerPoint glyph bounds',changes,requiresRerender:true},null,2));
console.log(JSON.stringify({adjustedGroups:changes.length,requiresRerender:true}));
