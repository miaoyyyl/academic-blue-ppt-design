import assert from 'node:assert/strict';
import {normalizeImageCrop,imageDisplayGeometry,auditFigurePlan,assertFigureAssets} from '../assets/figure-policy.mjs';
import {renderComponent} from '../assets/native-components/api.mjs';
import {makeFigureFrame} from '../assets/figure-frame-policy.mjs';
let checks=0;const test=(name,fn)=>{fn();checks++;};
test('legacy no metadata remains supported',()=>assert.equal(auditFigurePlan({schemaVersion:2,pages:[{id:'legacy',role:'content',operations:[]}]}).pass,true));
test('historical integer schemaVersion three is not the new figure interface',()=>assert.equal(auditFigurePlan({schemaVersion:3,pages:[{id:'legacy',role:'content',operations:[]}]}).pass,true));
for(const bad of [null,[0,0,0],[-.1,0,0,0],[.5,0,.5,0],[0,.8,0,.2],[NaN,0,0,0],[true,0,0,0],[.499999,0,.499999,0]])test('reject invalid crop',()=>assert.throws(()=>normalizeImageCrop(bad)));
test('full image letterbox',()=>assert.deepEqual(imageDisplayGeometry({width:1000,height:500,bounds:[10,10,400,400]}).actualBounds,[10,110,400,200]));
test('crop changes visible aspect without stretching',()=>assert.deepEqual(imageDisplayGeometry({width:1000,height:500,bounds:[10,10,400,400],imageCrop:[.25,0,.25,0]}).actualBounds,[10,10,400,400]));
test('alignment respects top right',()=>assert.deepEqual(imageDisplayGeometry({width:500,height:1000,bounds:[10,10,400,400],imageAlign:'right-top'}).actualBounds,[210,10,200,400]));
const fixture={schemaVersion:3,planningInterface:'WordDeckPlan-v3',pages:[{id:'p',role:'content',thesis:'共同判断',visibleArgument:'共同判断',modules:[{id:'m'}],notes:'次要细节',operations:[{id:'text',fields:{body:'共同判断'}},{id:'im',typeId:'materials-paper-image',assetId:'a',bounds:[0,100,300,300],imageCrop:[.1,.1,.1,.1]}],supportFigures:[{id:'f',operationId:'im',assetId:'a',figureType:'mechanism',figureRole:'supporting-explanation',claimModuleIds:['m'],readingTargets:[{name:'关键路径',task:'recognize',rect:[.2,.2,.5,.5]}],captionPolicy:'short'}],contentRouting:[{id:'r',importance:'key',sourceIds:['p-001'],destination:'body',target:{operationId:'text',slot:'body'},visibleText:'共同判断'},{id:'d',importance:'detail',sourceIds:['p-002'],destination:'speaker',notesText:'次要细节'}]}]};
fixture.pages[0].operations.find(o=>o.id==='im').bounds[0]=10;
fixture.pages[0].operations.splice(1,0,makeFigureFrame(fixture.pages[0].supportFigures,fixture.pages[0].operations,{id:'native-frame',style:'dashed'}));
test('v3 linked argument and detail in notes pass',()=>assert.equal(auditFigurePlan(fixture).pass,true));
for(const [name,mutate,code] of [
 ['unbound image',p=>p.supportFigures=[],'UNPLANNED_CONTENT_IMAGE'],
 ['reading target lost in crop',p=>p.supportFigures[0].readingTargets[0].rect=[0,0,.5,.5],'FIGURE_READING_TARGET_CROPPED_OR_INVALID'],
 ['unbound claim',p=>p.supportFigures[0].claimModuleIds=['missing'],'FIGURE_CLAIM_BINDING_INVALID'],
 ['invisible key',p=>p.contentRouting[0].destination='source','KEY_CONTENT_MUST_BE_VISIBLE'],
 ['invented visible text',p=>p.contentRouting[0].visibleText='不存在','CONTENT_BODY_TARGET_INVALID'],
 ['generated evidence',p=>{p.supportFigures[0].sourceKind='generated-illustration';p.supportFigures[0].figureRole='primary-evidence';},'GENERATED_IMAGE_IS_NOT_EVIDENCE']
])test(name,()=>{const copy=structuredClone(fixture);mutate(copy.pages[0]);assert(auditFigurePlan(copy).issues.some(i=>i.code===code));});
const slide={nativeOperations:[]};
test('asset registration is enforced',()=>assert.throws(()=>assertFigureAssets(fixture,{assets:[]})));
test('registered source kind is authoritative',()=>{const copy=structuredClone(fixture);copy.pages[0].supportFigures[0].sourceKind='word-image';assert.throws(()=>assertFigureAssets(copy,{assets:[{asset_id:'a',kind:'external-photo'}]}));});
test('generated asset cannot become evidence by omitting source kind',()=>{const copy=structuredClone(fixture);copy.pages[0].supportFigures[0].figureRole='primary-evidence';assert.throws(()=>assertFigureAssets(copy,{assets:[{asset_id:'a',kind:'generated-illustration'}]}));});
const bad=await renderComponent({typeId:'materials-paper-image',slide,bounds:[0,0,300,300],content:{assetId:'a',imageCrop:[.8,0,.8,0]}});assert.equal(bad.ok,false);checks++;
const good=await renderComponent({typeId:'materials-paper-image',slide,bounds:[0,0,300,300],content:{assetId:'a',imageCrop:[.2,0,.1,0]}});assert(good.ok);assert.deepEqual(slide.nativeOperations[0].imageCrop,[.2,0,.1,0]);checks++;
console.log(JSON.stringify({pass:true,checks}));
