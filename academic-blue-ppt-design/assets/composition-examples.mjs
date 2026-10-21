/** Neutral executable requests. Caller supplies the registered image bytes. */
import {compileComposition} from './composition-layout.mjs';
import {relationshipCatalog} from './relation-compositions.mjs';
import {relationshipExample} from './relationship-examples.mjs';
import {regionCatalog} from './region-compositions.mjs';
import {regionExample} from './region-examples.mjs';
const sentence='作用：对象的性质与所处条件共同影响响应，比较时保留条件差异。';
export function compositionExample(id,variant='standard'){
  const reference=referenceExample(id,variant);if(reference)return {...reference,pageId:id+'-'+variant};
  if(regionCatalog.some(c=>c.id===id))return regionExample(id,variant);
  if(relationshipCatalog.some(c=>c.id===id))return relationshipExample(id,variant);
  const g=(i,role)=>({id:'unit-'+i,heading:['类别甲','类别乙','类别丙','类别丁'][i],paras:[sentence],sourceIds:['neutral-'+i],visualIntent:'mechanism',...(role?{role}:{})});
  const fig=(i,ids)=>({id:'neutral-f'+i,assetId:'neutral-wide',dimensions:[1200,650],figureType:'mechanism',figureRole:'supporting-explanation',sourceKind:'generated-illustration',claimModuleIds:ids,readingTargets:[{name:'主要对象及相连路径',task:'recognize',rect:[.04,.04,.92,.92]}],captionPolicy:'none',imageAlign:'left-top'});
  let groups=[g(0),g(1)],figures=[],relation='parallel',options={};
  if(id==='peer-text-panels')options.treatment='tab';
  if(id==='peer-figure-columns'){figures=groups.map((gg,i)=>fig(i,[gg.id]));}
  if(id==='text-over-figures'){figures=[fig(0,groups.map(g=>g.id))];options.treatment='filled';}
  if(id==='figure-with-explanations'){figures=[fig(0,groups.map(g=>g.id))];options={figurePosition:'right',textWidth:460,treatment:'tab',labelWidth:115};}
  if(id==='labeled-rows'){groups=[g(0),g(1),g(2)];options={labelWidth:160,gap:18};}
  if(id==='context-and-notes'){relation='context-evidence';groups[0].heading='背景定位';groups[1].heading='主要依据';}
  if(id==='process-with-evidence'){relation='process';groups=[g(0,'step'),g(1,'step'),g(2,'step')];figures=[fig(0,groups.map(g=>g.id))];}
  if(id==='stages-with-local-figures'){relation='process';groups=[g(0,'step'),g(1,'step'),g(2,'step')];figures=groups.map((gg,i)=>fig(i,[gg.id]));options.figureHeight=220;}
  if(id==='evidence-and-details'){relation='total-detail';groups=[g(0,'core'),g(1,'detail'),g(2,'detail')];figures=[fig(0,[groups[0].id])];}
  if(['peer-text-panels','labeled-rows','context-and-notes'].includes(id))figures=[fig(0,groups.map(g=>g.id))];
  let request={compositionId:id,groups,figures,relation,options,pageId:id+'-'+variant};
  if(variant==='optional'){
    if(figures.length){figures[0].imageCrop=[.02,.02,.02,.02];figures[0].caption='对象关系示意';figures[0].captionPolicy='short';}
    if(id==='peer-text-panels')options.treatment='badge';
    if(id==='peer-figure-columns')options.order='heading-body-image';
    if(id==='text-over-figures')figures.push(fig(1,groups.map(g=>g.id)));
    if(id==='figure-with-explanations'){figures[0].assetId='neutral-tall';figures[0].dimensions=[600,1000];options.figurePosition='left';options.textWidth=600;}
    if(id==='labeled-rows'){groups.pop();figures[0].claimModuleIds=groups.map(g=>g.id);}
    if(id==='context-and-notes')options.bullet='human-square-notes';
    if(id==='process-with-evidence'){groups.push(g(3,'condition'));figures[0].assetId='neutral-tall';figures[0].dimensions=[600,1000];options.figurePosition='right';options.processWidth=690;}
    if(id==='evidence-and-details')options.coreWidth=630;
  }
  if(variant==='capacity'){
    const base=groups[0].paras[0],chunk='条件改变时，响应的范围与解释口径也随之调整。';let max=0;
    for(let n=1;n<=100;n++){groups[0].paras=[base+chunk.repeat(n)];if(!compileComposition(request).ok)break;max=n;}
    const n=Math.max(1,Math.floor(max*.84));groups[0].paras=[base+chunk.repeat(n)];request.capacityProbe={maximumExtraChunks:max,usedExtraChunks:n,ratioOfExtraCapacity:max?n/max:1};
  }
  return request;
}
import {referenceExample} from './reference-examples.mjs';
