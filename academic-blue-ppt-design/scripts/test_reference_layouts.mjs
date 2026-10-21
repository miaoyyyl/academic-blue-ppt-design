import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {referenceCatalog,auditReferenceLayouts} from '../assets/reference-layouts.mjs';
import {referenceExample} from '../assets/reference-examples.mjs';
import {compileComposition,chooseComposition} from '../assets/composition-layout.mjs';
import {auditComposition} from '../assets/composition-policy.mjs';
import {structureSignature} from '../assets/layout-diversity.mjs';
import {createPageLead} from '../assets/page-lead.mjs';
const out=path.resolve(process.argv[2]||'reference-tests');fs.mkdirSync(out,{recursive:true});
const pages=[],checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
for(const recipe of referenceCatalog){
 for(const variant of ['standard','capacity','optional']){
  const req=referenceExample(recipe.id,variant),compiled=compileComposition({...req,pageId:recipe.id});
  check(recipe.id+'/'+variant,()=>assert(compiled.ok,JSON.stringify(compiled.errors)));
  const page={id:recipe.id,title:recipe.name,role:'content',chapterId:'c1',sourceIds:['neutral-reference'],modules:req.groups,...compiled};
  const audit=auditComposition({pages:[page]});check(recipe.id+'/'+variant+'/full-audit',()=>assert(audit.pass,JSON.stringify(audit.issues)));
  if(variant==='standard'){
   const selected=chooseComposition({...req,selection:{mode:'auto'}});check(recipe.id+'/auto-selection',()=>assert.equal(selected.selected,recipe.id));
   page.operations.unshift({id:page.id+'-header',typeId:'materials-frame',bounds:[0,0,1280,77],fields:{title:recipe.name,number:'1.'+(pages.length+1)},textOptions:{title:{font:29,color:'FFFFFF',box:[124,10,1100,57]},number:{font:23,color:'004BAD',align:'ctr',box:[45,13,73,50]}}});
   page.lead={mode:'none'};page.subsectionId='reference-unit';pages.push(page);
  }
 }
 const bad=referenceExample(recipe.id);bad.groups[0].role='unknown';check(recipe.id+'/reject-role-loss',()=>assert(!compileComposition(bad).ok));
 const dense=referenceExample(recipe.id);dense.groups[0].paras=['条件说明。'.repeat(200)];check(recipe.id+'/reject-overflow',()=>assert(!compileComposition(dense).ok));
}
check('four distinct geometries',()=>assert.equal(new Set(pages.map(p=>structureSignature(p).fingerprint)).size,4));
const plan={schemaVersion:2,implementation:'materials-native-clone',planningInterface:'WordDeckPlan-v4',chapters:[{id:'c1',title:'结构中性验证'}],pages};
for(const p of pages){
 p.contentRouting.unshift({id:p.id+'-argument',sourceIds:p.sourceIds,importance:'key',destination:'body',target:{operationId:p.id+'-header',slot:'title'},visibleText:p.title});
}
for(const p of pages.filter(p=>p.referenceEdges.length)){
 const wrong=structuredClone(p);wrong.referenceEdges[0].sourceIds=[];check(p.id+'/reject-unsourced-link',()=>assert(!auditReferenceLayouts({pages:[wrong]}).pass));
}
const timeline=structuredClone(pages[1]);delete timeline.operations.find(o=>o.typeId==='materials-timeline-four').fields.date3;check('reject-missing-fourth-node',()=>assert(!auditReferenceLayouts({pages:[timeline]}).pass));
const mapping=structuredClone(pages[2]);mapping.referenceEdges[0].toOperationId=mapping.referenceEdges[1].toOperationId;check('reject-wrong-row',()=>assert(!auditReferenceLayouts({pages:[mapping]}).pass));
const reversed=structuredClone(pages[3]);reversed.operations.find(o=>o.typeId==='materials-inward-left').typeId='materials-inward-right';check('reject-outward-arrow',()=>assert(!auditReferenceLayouts({pages:[reversed]}).pass));
const full=auditComposition(plan);check('whole neutral deck',()=>assert(full.pass,JSON.stringify(full.issues)));
fs.writeFileSync(path.join(out,'neutral-reference-plan.json'),JSON.stringify(plan,null,2));
fs.writeFileSync(path.join(out,'reference-regression.json'),JSON.stringify({pass:true,checks:checks.length,checked:checks},null,2));
console.log(JSON.stringify({pass:true,checks:checks.length,pages:pages.length}));
