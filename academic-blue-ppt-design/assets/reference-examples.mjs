/** Neutral semantic fixtures; no source scientific content or default assets. */
export function referenceExample(id,variant='standard'){
 const capacity=variant==='capacity',sourceIds=['neutral-reference'],g=(id,role,heading,paras)=>({id,role,heading,paras:Array.isArray(paras)?paras:[paras],sourceIds,visualIntent:'context'}),f=(id,ms,d=[600,400])=>({id,assetId:'neutral-'+id,dimensions:d,claimModuleIds:ms,figureType:'scene',figureRole:'context',captionPolicy:'none',minimumDisplay:{width:100,height:64},readingTargets:[{name:'整体示意',task:'recognize',rect:[0,0,1,1]}]});
 let groups,figures;
 if(id==='theory-mechanism-application'){
  groups=[g('t1','theory','对象甲','条件范围'),g('t2','theory','对象乙','作用差异'),g('t3','theory','对象丙','结果解释'),g('m','mechanism','共同机理','输入共同参与该机制。'),g('i1','input','输入甲','对象特征'),g('i2','input','输入乙','比较条件'),g('a','application','应用证据',capacity?'解释图中对象之间的关系，并保留比较条件及适用范围。':'图像与解释共同支撑本页判断。')];figures=[f('t',['t1','t2','t3'],[600,320]),f('m',['m'],[600,400]),f('a',['a'],[600,500])];
 }else if(id==='perspectives-timeline-evidence'){
  groups=[...['对象范围','方法条件','证据类型','应用方向'].map((s,i)=>g('p'+i,'perspective',s,capacity?'说明本维度的对象、适用条件和对应证据。':'说明本维度的对象与适用条件。')),...['准备','观察','比较','归纳'].map((s,i)=>({...g('m'+i,'milestone',s,'任务说明'),date:'2024.'+String(3+i*2).padStart(2,'0')})),g('e1','evidence','图证甲','对照对象与条件'),g('e2','evidence','图证乙','保留适用范围')];figures=[f('e1',['e1'],[1200,400]),f('e2',['e2'],[1200,400])];
 }else if(id==='evidence-rows-and-focus'){
  groups=[...['现象观察','条件比较','结果解释'].map((s,i)=>g('r'+i,'finding',s,capacity?'图像对应本条发现，保留对象及比较条件。':'说明本图对应的观察与条件。')),g('core','core','综合图证','综合图保留相关对象与证据范围。')];figures=[...groups.slice(0,3).map((m,i)=>f('row'+i,[m.id],[600,400])),f('core',['core'],[600,750])];
 }else if(id==='questions-focus-evidence-strip'){
  groups=[...['对象特征','条件范围','比较方法'].map((s,i)=>g('l'+i,'established',s,'已有认识')),...['核心任务','验证边界'].map((s,i)=>g('c'+i,'focus',s,capacity?'围绕该问题组织研究对象、方法和判断依据，保留验证边界。':'围绕问题组织对象、方法和判断依据。')),...['新对象','应用条件','稳定性'].map((s,i)=>g('r'+i,'planned',s,'拟开展'))];figures=[f('s1',['l0']),f('s2',['c0']),f('s3',['c1']),f('s4',['r0'])];
 }else return null;
 return {compositionId:id,relation:id==='questions-focus-evidence-strip'?'conditions':'total-detail',task:{'theory-mechanism-application':'theory-to-application','perspectives-timeline-evidence':'perspectives-and-milestones','evidence-rows-and-focus':'findings-with-focus','questions-focus-evidence-strip':'questions-and-research'}[id],groups,figures,bounds:[44,110,1192,547],options:{relationEvidence:{kind:'sourced-organization',sourceIds}},assets:Object.fromEntries(figures.map(f=>[f.assetId,{asset_id:f.assetId,dimensions:f.dimensions}]))};
}
