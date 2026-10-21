/** Observable registry/API behavior for the isolated candidate primitive patch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {findCases,renderComponent,bankDir} from '../assets/native-components/api.mjs';
import {recommendComponents} from '../assets/component-selection.mjs';
const checks=[];
const entries=[['mixed-region-container','materials-mixed-region-frame'],['local-annotation','materials-inset-note'],['module-heading','materials-folded-tab'],['region-conclusion','materials-conclusion-strip'],['feedback-return','materials-feedback-return']];
for(const [task,typeId]of entries){
 const r=recommendComponents({task,relation:task==='feedback-return'?'feedback':undefined});
 assert(r.ok&&r.cases.some(c=>c.typeId===typeId));checks.push('query '+task);
 const p=JSON.parse(fs.readFileSync(path.join(bankDir,'examples',typeId+'-standard.json'),'utf8'));
 const op=p.operations[0],slide={nativeOperations:[]};
 const built=await renderComponent({typeId,slide,bounds:op.bounds,content:op});
 assert(built.ok&&slide.nativeOperations.length===1&&slide.nativeOperations[0].typeId===typeId);checks.push('record native '+typeId);
}
const invalid=recommendComponents({task:'feedback-return',relation:'parallel'});
assert(!invalid.ok&&invalid.errors.includes('FEEDBACK_RETURN_REQUIRES_FEEDBACK_RELATION'));checks.push('reject feedback for parallel items');
const region=findCases({typeId:'materials-mixed-region-frame'})[0];
assert(region.containerContract.figureFrameEquivalent===false);checks.push('region does not masquerade as an image frame');
console.log(JSON.stringify({pass:true,checks:checks.length}));
