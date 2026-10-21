/** Neutral semantic-region requests; no scientific defaults. */
import {compileComposition} from './composition-layout.mjs';
const src=['neutral-p-1'];
const group=(id,heading='方法说明',paras=['说明对象、条件与适用范围，证据对应当前判断。'])=>({id,heading,paras,sourceIds:src,visualIntent:'mechanism',level:1});
const fig=(id,m)=>({id,assetId:'neutral-wide',dimensions:[1200,650],claimModuleIds:[m],figureType:'mechanism',figureRole:'supporting-explanation',sourceKind:'generated-illustration',captionPolicy:'none',minimumDisplay:{width:105,height:70},readingTargets:[{name:'主体',task:'recognize',rect:[0,0,1,1]}]});
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

export function regionExample(id,variant='standard'){
 const q=structuredClone(cases.find(c=>c.compositionId===id));if(!q)throw Error('REGION_EXAMPLE_NOT_FOUND');
 q.pageId=id+'-'+variant;
 if(variant==='capacity'){
  const base=q.groups[0].paras[0],chunk='条件与对象变化时保留相应范围。';let max=0;
  for(let n=1;n<=30;n++){q.groups[0].paras=[base+chunk.repeat(n)];if(!compileComposition(q).ok)break;max=n;}
  const used=Math.floor(max*.75);q.groups[0].paras=[base+chunk.repeat(used)];q.capacityProbe={maximumExtraChunks:max,usedExtraChunks:used};
 }
 return q;
}
