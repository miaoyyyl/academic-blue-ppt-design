/** Content-free positive cases; scientific evidence is supplied only by a task. */
import {compileComposition} from './composition-layout.mjs';
export function relationshipExample(id,variant='standard'){
 const g=(i,role='peer')=>({id:'unit-'+i,heading:['对象甲','对象乙','对象丙','对象丁','对象戊'][i],paras:['说明当前对象的条件与作用。'],sourceIds:['neutral-'+i],visualIntent:'mechanism',role});
 let groups=[g(0),g(1),g(2)],relation,options={};
 if(id==='timeline-with-evidence'){relation='temporal';groups=groups.map((g,i)=>({...g,date:'202'+i+'年'}));options.relationEvidence={sourceIds:['neutral-0'],kind:'temporal'};}
 if(id==='numbered-with-evidence')relation='unordered';
 if(id==='classified-with-evidence')relation='classification';
 if(id==='merge-with-evidence'){relation='merge';groups=[g(0,'input'),g(1,'input'),g(2,'result')];options.relationEvidence={sourceIds:['neutral-0'],kind:'merge'};}
 if(id==='branch-with-evidence'){relation='total-detail';groups=[g(0,'core'),g(1,'detail'),g(2,'detail')];}
 if(id==='cycle-with-evidence'){relation='cycle';options={center:'回用关系',relationEvidence:{sourceIds:['neutral-0'],kind:'cycle',edges:[['unit-0','unit-1'],['unit-1','unit-2'],['unit-2','unit-0']]}};}
 if(id==='matrix-with-evidence'){relation='comparison';groups=Array.from({length:5},(_,i)=>({...g(i),paras:['主体'+i,'数值甲','时期甲','条件与适用范围']}));options.matrixHeaders=['类别','主体','观测值','时期','适用条件'];}
 if(id==='response-with-evidence'){relation='problem-response';groups=[g(0),g(1)].map(g=>({...g,paras:['描述当前问题与条件。','说明回应问题的行动。']}));}
 const figures=[{id:'neutral-figure',assetId:'neutral-wide',dimensions:[1200,650],figureType:'mechanism',figureRole:'supporting-explanation',claimModuleIds:groups.map(g=>g.id),readingTargets:[{name:'中性图像的对象',task:'recognize',rect:[.04,.04,.92,.92]}],captionPolicy:'none',imageAlign:'center'}];
 const q={compositionId:id,relation,groups,figures,options,pageId:id+'-'+variant};
 if(variant==='optional'){
  figures[0].caption='中性测试图，不承载科学结论';figures[0].captionPolicy='short';
  figures[0].imageCrop=[.02,.02,.02,.02];
 }
 if(variant==='capacity'){
  const slot=['matrix-with-evidence','response-with-evidence'].includes(id)?groups[0].paras.length-1:0;
  const base=groups[0].paras[slot];let count=0;
  for(let n=1;n<20;n++){groups[0].paras[slot]=base+'保留作用边界。'.repeat(n);if(!compileComposition(q).ok)break;count=n;}
  groups[0].paras[slot]=base+'保留作用边界。'.repeat(Math.floor(count*.8));
 }
 return q;
}
