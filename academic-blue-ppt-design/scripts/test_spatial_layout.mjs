import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compileComposition,compositionCatalog} from '../assets/composition-layout.mjs';
import {compositionExample} from '../assets/composition-examples.mjs';
import {auditSpatialLayout,measureSpatialPage,applySpatialPlan,moveLayout,auditRenderedSpatial} from '../assets/spatial-layout.mjs';
const checks=[];
// Geometry-only fixtures omit semantic visual planning; content integration tests
// separately enforce the sparse-page policy and relevant figure requirements.
const compactExample=(id)=>{const q=compositionExample(id);q.figures=[];q.groups.forEach(g=>delete g.visualIntent);return q;};
const check=(name,fn)=>{fn();checks.push({name,pass:true});};
const asPage=(q,c)=>({id:q.pageId,role:'content',compositionId:q.compositionId,compositionBounds:q.bounds||[44,177,1192,480],operations:c.operations,contentGroups:c.contentGroups,supportFigures:c.supportFigures,compositionBindings:c.bindings,spatialLanes:c.spatialLanes,spatialLayout:c.spatialLayout});
for(const recipe of compositionCatalog)for(const variant of ['short','standard','capacity','optional'])check(recipe.id+'/'+variant,()=>{
  const q=compositionExample(recipe.id,variant==='short'?'standard':variant);
  if(variant==='short')q.groups.forEach(g=>g.paras=g.paras.map(()=> '条件影响响应。'));
  const c=compileComposition(q);
  if(variant==='short'&&recipe.roles&&!c.ok){assert(c.errors.every(e=>/CAPACITY|SPARSE/.test(e.code)),JSON.stringify(c.errors));return;}
  assert.ok(c.ok,JSON.stringify(c.errors));
  assert.ok(c.occupiedBounds&&c.availableBounds&&c.spatialLayout);
  const a=auditSpatialLayout({pages:[{...asPage(q,c),pairedRegions:c.pairedRegions}]});
  const expectedSparse=new Set(['labeled-rows/optional','context-and-notes/short','context-and-notes/standard','context-and-notes/optional','evidence-and-details/short','evidence-and-details/standard','evidence-and-details/capacity','evidence-and-details/optional']);
  if(expectedSparse.has(recipe.id+'/'+variant))assert(a.issues.length>0&&a.issues.every(i=>i.code==='LOCAL_REGION_CONTENT_TOO_SPARSE'),JSON.stringify(a.issues));
  else assert.ok(a.pass,JSON.stringify(a.issues));
});
for(const id of ['peer-text-panels','labeled-rows','process-with-evidence'])check(id+'/compact group moves without stretching',()=>{
  const q=compositionExample(id);q.groups.forEach(g=>{g.paras=['说明条件。'];delete g.visualIntent;});
  if(id==='labeled-rows')q.groups=q.groups.slice(0,3);
  q.figures=[];
  q.options.verticalPlacement='top';const top=compileComposition(q);
  q.options.verticalPlacement='auto';const c=compileComposition(q);assert.ok(c.ok);
  assert.ok(c.occupiedBounds[1]>top.occupiedBounds[1]+40);
  for(let i=0;i<c.operations.length;i++){
    assert.equal(c.operations[i].typeId,top.operations[i].typeId);
    assert.equal(c.operations[i].bounds[2],top.operations[i].bounds[2]);
    assert.equal(c.operations[i].bounds[3],top.operations[i].bounds[3]);
    for(const slot of Object.keys(c.operations[i].textOptions||{}))assert.equal(c.operations[i].textOptions[slot].font,top.operations[i].textOptions[slot].font);
  }
  const a=auditSpatialLayout({pages:[asPage(q,top)]});assert.ok(a.issues.some(x=>x.code==='BODY_TOP_HEAVY'));
  const arrows=c.operations.filter(o=>o.typeId==='materials-flow-arrow');
  if(arrows.length){const step=c.operations.find(o=>o.typeId==='materials-flow-step');assert.ok(Math.abs(arrows[0].bounds[1]+15-step.bounds[1]-step.bounds[3]/2)<.01);}
});
check('placement validates modes',()=>{const q=compactExample('peer-text-panels');q.options.verticalPlacement='stretch';assert.equal(compileComposition(q).errors[0].code,'SPATIAL_PLACEMENT_INVALID');});
check('stale usedBounds cannot hide top-heavy content',()=>{
  const q=compactExample('peer-text-panels');q.options.verticalPlacement='top';const p=asPage(q,compileComposition(q));p.spatialLayout={occupiedBounds:[44,177,1192,480],pass:true};
  assert.ok(!auditSpatialLayout({pages:[p]}).pass);
});
check('top placement does not waive review',()=>{const q=compactExample('peer-text-panels');q.options.verticalPlacement='top';const p=asPage(q,compileComposition(q));p.compositionRationale='有意留白';assert.ok(!auditSpatialLayout({pages:[p]}).pass);});
check('actual geometry wins over a centered plan',()=>{
  const q=compactExample('peer-text-panels');const p=asPage(q,compileComposition(q));
  const dy=177-Math.min(...p.operations.map(o=>o.bounds[1]));
  for(const o of p.operations){o._actualOperationBounds=[o.bounds[0],o.bounds[1]+dy,o.bounds[2],o.bounds[3]];}
  assert.ok(auditSpatialLayout({pages:[p]}).pass);
  assert.ok(!auditSpatialLayout({pages:[p]},{actualEvidence:true}).pass);
});
check('increasing empty panel height cannot fake balanced content',()=>{
  const q=compactExample('peer-text-panels');q.options.treatment='filled';const c=compileComposition(q),p=asPage(q,c);
  for(const o of p.operations){o.bounds=[o.bounds[0],177,o.bounds[2],480];o.textOptions.body.box=[o.bounds[0]+15,232,o.bounds[2]-30,414];}
  assert.ok(auditSpatialLayout({pages:[p]}).issues.some(x=>x.code==='BODY_PANEL_EXCESSIVE_EMPTY_HEIGHT'));
});
check('legacy and direct operations are balanced once, fixed furniture stays',()=>{
  const q=compactExample('peer-text-panels');q.options.verticalPlacement='top';const c=compileComposition(q);
  const page={...asPage(q,c),compositionId:undefined,spatialLayout:undefined,layoutTemplate:'legacy',operations:[{id:'head',typeId:'materials-frame',bounds:[0,0,1280,77]},...c.operations,{id:'foot',typeId:'materials-caption',bounds:[44,681,1190,25],fields:{body:'来源'}}]};
  const result=applySpatialPlan({pages:[page]});const twice=applySpatialPlan(result);
  assert.deepEqual(result,twice);assert.deepEqual(result.pages[0].operations[0].bounds,[0,0,1280,77]);assert.equal(result.pages[0].operations.at(-1).bounds[1],681);
  assert.ok(auditSpatialLayout(result).pass);
});
check('absolute geometry, figure bindings and nested coordinates keep their spaces',()=>{
  const state={operations:[{id:'a',typeId:'materials-paper-image',bounds:[50,180,200,100],imageCrop:[.1,0,0,0],textOptions:{body:{box:[55,185,190,90],nested:{box:[1,2,3,4]}}},objectBoxes:{'8':[50,180,200,100]}}],contentGroups:[],bindings:[{operationId:'a',bounds:[50,180,200,100],requestedBounds:[50,180,200,130],displayBounds:[50,180,200,100]}],supportFigures:[{operationId:'a',requestedBounds:[50,180,200,130],displayGeometry:{actualBounds:[50,180,200,100],sourceWindow:[.1,0,.9,1]},readingTargets:[{rect:[.1,.1,.8,.8]}]}]};
  moveLayout(state,['a'],0,40);assert.equal(state.operations[0].textOptions.body.box[1],225);assert.equal(state.operations[0].objectBoxes['8'][1],220);assert.equal(state.bindings[0].displayBounds[1],220);
  assert.deepEqual(state.operations[0].textOptions.body.nested.box,[1,2,3,4]);assert.deepEqual(state.supportFigures[0].readingTargets[0].rect,[.1,.1,.8,.8]);assert.deepEqual(state.supportFigures[0].displayGeometry.sourceWindow,[.1,0,.9,1]);
});
check('occupiedBounds measures the output instead of the allocation',()=>{const q=compactExample('peer-text-panels'),c=compileComposition(q);assert.ok(c.occupiedBounds[3]<c.availableBounds[3]);assert.deepEqual(measureSpatialPage(asPage(q,c)).occupiedBounds,c.occupiedBounds);assert.deepEqual(c.usedBounds,c.availableBounds);});
check('a render without native objects cannot pass using planned geometry',()=>{const q=compactExample('peer-text-panels'),p=asPage(q,compileComposition(q));assert.ok(auditRenderedSpatial({pages:[p]},[],[{page:1,objects:[],texts:[]}]).issues.some(x=>x.code==='SPATIAL_RENDER_OPERATION_MISSING'));});
check('a compressed declared region cannot conceal physical top placement',()=>{const q=compactExample('peer-text-panels');q.options.verticalPlacement='top';const p=asPage(q,compileComposition(q));p.compositionBounds=[44,177,1192,220];assert.ok(auditSpatialLayout({pages:[p]}).issues.some(x=>x.code==='BODY_TOP_HEAVY'));});
const report={pass:true,checks,recipes:compositionCatalog.length};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,checks:checks.length}));
