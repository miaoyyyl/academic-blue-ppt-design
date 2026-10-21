import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {compileComposition,chooseComposition,compositionCatalog} from '../assets/composition-layout.mjs';
import {auditRegions} from '../assets/region-policy.mjs';
import {auditComposition} from '../assets/composition-policy.mjs';
const out=path.resolve(process.argv[2]||'region-tests');fs.mkdirSync(out,{recursive:true});
const src=['neutral-p-1'];
const group=(id,heading='方法说明',paras=['说明对象、条件与适用范围，证据对应当前判断。'])=>({id,heading,paras,sourceIds:src,visualIntent:'context',level:1});
const fig=(id,m)=>({id,assetId:'neutral',dimensions:[600,400],claimModuleIds:[m],figureType:'scene',figureRole:'context',captionPolicy:'none',minimumDisplay:{width:105,height:70},readingTargets:[{name:'主体',task:'recognize',rect:[0,0,1,1]}]});
const region=(id,ms,fs,rect,extra={})=>({id,purpose:'解释本区域对象及相应证据',heading:'对象与证据',moduleIds:ms,figureIds:fs,rect,kind:'evidence',...extra});
const cases=[];
{
 const groups=[group('a'),group('b')],figures=[fig('a1','a'),fig('a2','a'),fig('b1','b')];
 cases.push({id:'multi-picture',compositionId:'mixed-evidence-regions',relation:'parallel',groups,figures,regions:[region('left',['a'],['a1','a2'],[0,0,.48,1]),region('right',['b'],['b1'],[.52,0,.48,1])]});
}
{
 const groups=[group('a'),group('b','结果条件',['根据证据判断变化及适用条件。']),group('c','结果解释',['比较对象差异及对应说明。'])],figures=[fig('a1','a'),fig('b1','b'),fig('c1','c')];
 cases.push({id:'method-results',compositionId:'method-and-stacked-results',relation:'evidence',groups,figures});
}
{
 const groups=[group('a'),group('b'),group('c','局部说明',['局部说明对应当前条件。'])],figures=[fig('a1','a'),fig('b1','b')];
 const children=[region('diagram',['b'],['b1'],[0,0,1,.61]),region('note',['c'],[],[0,.66,1,.34],{kind:'notes'})];
 cases.push({id:'nested-notes',compositionId:'principle-and-method-regions',relation:'total-detail',groups,figures,regions:[region('concept',['a'],['a1'],[0,0,.36,1],{headingStyle:'folded'}),region('method',[],[],[.40,0,.60,1],{children})]});
}
{
 const groups=[group('a'),group('b','定义甲',['说明对象与条件。']),group('c','定义乙',['保留实际适用范围。']),group('d','过程甲',['完成前一环节。']),group('e','过程乙',['进入后续环节。'])],figures=[fig('a1','a'),fig('a2','a')];
 cases.push({id:'definitions-flow',compositionId:'images-definitions-local-flow',relation:'process',groups,figures,regions:[region('pictures',['a'],['a1','a2'],[0,0,.36,1]),region('definitions',['b','c'],[],[.40,0,.60,.56],{kind:'numbered'}),region('flow',['d','e'],[],[.40,.62,.60,.38],{kind:'flow'})]});
}
{
 const groups=['a','b','c','d'].map((id,i)=>({...group(id,'子区'+String.fromCharCode(65+i),['说明该子区对应的条件与判断。']),targetNames:[String.fromCharCode(65+i)]}));groups.push(group('conclusion','区域结论',['本区域证据共同支撑该判断，适用条件仍需保留。']));
 const figures=[{...fig('a1','a'),claimModuleIds:['a','b','c','d','conclusion'],readingTargets:['A','B','C','D'].map((name,i)=>({name,task:'recognize',rect:[(i%2)*.5,Math.floor(i/2)*.5,.5,.5]}))}];
 cases.push({id:'multipart-callouts',compositionId:'multipart-figure-callouts',relation:'evidence',groups,figures,regions:[region('research',groups.map(g=>g.id),['a1'],[0,0,1,1],{kind:'callouts',conclusionModuleId:'conclusion'})]});
}
{
 const groups=[group('a','条件甲',['明确入口。']),group('b','条件乙',['限定范围。']),group('c','整合判断',['共同形成结果。']),group('d','准备',['明确对象与条件。']),group('e','实施',['完成相应操作。']),group('f','复核',['核对结果并反馈。'])];
 cases.push({id:'idea-route',compositionId:'idea-and-route-lanes',relation:'process',groups,figures:[],regions:[region('idea',['a','b','c'],[],[0,0,1,.48],{kind:'merge',sideLabel:'整体思路'}),region('route',['d','e','f'],[],[0,.52,1,.48],{kind:'flow',sideLabel:'技术路线',feedback:{fromId:'f',toId:'d',sourceIds:src}})]});
}
const checked=[],pages=[];
for(const c of cases){
 const built=compileComposition({...c,pageId:c.id,bounds:[44,110,1192,547]});
 if(!built.ok){console.log(c.id,JSON.stringify(built.errors));continue;}
 const page={id:c.id,role:'content',title:'中性区域结构',chapterId:'c1',modules:c.groups,sourceIds:src,relation:c.relation,compositionId:c.compositionId,compositionBounds:[44,110,1192,547],...built,notes:'只检验区域和原生对象，不含科学结论。'};
 const audit=auditComposition({pages:[page]});
 if(!audit.pass)console.log(c.id,JSON.stringify(audit.issues));
 assert(audit.pass,c.id+' full audit');pages.push(page);checked.push(c.id);
}
assert.equal(pages.length,6,'six executable regional topologies');
const sample=cases[0];
const picked=chooseComposition({...sample,task:'multi-region-evidence',selection:{mode:'auto'},bounds:[44,110,1192,547]});assert(picked.ok&&picked.selected==='mixed-evidence-regions');checked.push('auto regional selection');
const old=compileComposition({...sample,compositionId:'peer-figure-columns',regions:undefined});assert(!old.ok);checked.push('old one-figure-per-peer stays explicit');
const drop=compileComposition({...sample,compositionId:'peer-figure-columns'});assert(!drop.ok&&drop.errors[0].code==='REGIONS_REQUIRE_REGIONAL_COMPOSITION');checked.push('reject silent region loss');
const orphan=structuredClone(pages[0]);orphan.contentRegions[0].operationIds=['absent'];assert(!auditRegions({pages:[orphan]}).pass);checked.push('reject orphan members');
const empty=structuredClone(pages[0]);empty.operations=empty.operations.filter(o=>['materials-mixed-region-frame','materials-gradient-tab'].includes(o.typeId));assert(!auditRegions({pages:[empty]}).pass);checked.push('reject empty containers');
const badNote=structuredClone(pages[4]);badNote.operations.find(o=>o.annotationBinding).annotationBinding.targetNames=['unknown'];assert(!auditRegions({pages:[badNote]}).pass);checked.push('reject mismatched subfigure annotations');
const wrong=structuredClone(pages[5]);wrong.relationEdges[0].sourceIds=[];assert(!auditRegions({pages:[wrong]}).pass);checked.push('reject unsupported arrows');
const crop=structuredClone(cases[0]);crop.figures[0].minimumDisplay={width:900};assert(!compileComposition(crop).ok);checked.push('reject unreadable picture size');
const saved={schemaVersion:2,implementation:'materials-native-clone',planningInterface:'WordDeckPlan-v4',figurePolicy:{version:2},chapters:[{id:'c1',title:'中性章节'}],pages};
// These test pages use synthetic source ids and cannot pass the real Word input guard.
for(const p of saved.pages){p.subsectionId='same-unit';p.thesis=p.visibleArgument='中性区域结构';p.operations.unshift({id:p.id+'-header',typeId:'materials-frame',bounds:[0,0,1280,77],fields:{title:p.visibleArgument,number:'1'},textOptions:{title:{font:30,color:'FFFFFF',box:[124,10,1100,57]},number:{font:23,color:'004BAD',align:'ctr',box:[45,13,73,50]}}});p.contentRouting.unshift({id:p.id+'-argument',sourceIds:src,importance:'key',destination:'body',target:{operationId:p.id+'-header',slot:'title'},visibleText:p.visibleArgument});}
fs.writeFileSync(path.join(out,'neutral-region-plan.json'),JSON.stringify(saved,null,2));
fs.writeFileSync(path.join(out,'region-regression.json'),JSON.stringify({pass:true,checks:checked.length,checked,compositions:compositionCatalog.length},null,2));
console.log(JSON.stringify({pass:true,checks:checked.length,pages:pages.length,compositions:compositionCatalog.length}));
