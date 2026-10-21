/** Certified relationships and evidence regions made only from native bank objects. */
import {textHeight} from './narrative-layout.mjs';
const entry=(id,name,relations,groups,figures,sourceTypes,slots,use,avoid)=>({id,name,relations,groups,figures,sourceTypes,slots,adjustable:['关系区与图证区比例','原生槽位容量','主辅顺序'],use,avoid});
export const relationshipCatalog=[
 entry('timeline-with-evidence','阶段轴与证据区',['temporal'],[3,3],[1,3],['materials-timeline-three','materials-paper-image'],['三个有日期的阶段','下部证据图组'],'日期和阶段可核对。','把论证次序冒充历史阶段。'),
 entry('numbered-with-evidence','编号说明与侧证据',['unordered','parallel','classification'],[2,4],[1,2],['materials-circle-numbered-row','materials-paper-image'],['可逐项讲述的说明','侧边图证'],'编号用于定位内容，不表示时间。','用数字大小代替内容，或将编号画成因果。'),
 entry('classified-with-evidence','分类标签与主图',['classification','parallel'],[2,3],[1,1],['materials-hexagon-explanation','materials-paper-image'],['短分类标签','对应解释','一幅主图'],'不同类别需要明确定位。','标签过长或正文净宽不足。'),
 entry('merge-with-evidence','双输入汇合与证据',['merge','collaboration'],[3,3],[1,2],['materials-two-input-merge','materials-brace-group','materials-paper-image'],['两个输入','共同组织或结果','解释与图证'],'材料明确支持两个来源共同汇入。','三个并列事物冒充汇合过程。'),
 entry('branch-with-evidence','总点与括号展开',['total-detail','collaboration','conditions'],[3,4],[1,2],['materials-outline-condition','materials-brace-group','materials-paper-image'],['核心总点','二至三项展开','图证'],'总点展开为不同层次的作用、条件或职责。','把总分关系冒充时间或因果。'),
 entry('cycle-with-evidence','真实回流与应用图',['cycle'],[3,3],[1,1],['materials-cycle-three','materials-paper-image'],['闭环三个节点','中心主题','应用照片'],'原材料有明确回流关系。','只有去向或并列类别却画闭环。'),
 entry('matrix-with-evidence','渠道矩阵与侧图',['comparison','matrix'],[5,5],[1,2],['human-comparison-table','materials-paper-image'],['五条可核对记录','五个共同字段','侧图'],'主体、数值、时间和条件需对照。','混加存量流量，或把来源不齐的数据强排可比。'),
 entry('response-with-evidence','问题措施映射与场景',['problem-response'],[2,2],[1,2],['human-response-table','materials-paper-image'],['两类问题','问题表现','对应措施','下部场景'],'每项措施回应明确的问题。','场景照片充当效果验证。')
];

const BLUE='004BAD',INK='162B40';
const opts=(box,font=17,extra={})=>({box,font,color:INK,align:'l',vAlign:'t',leading:112,paragraphAfter:5,inset:0,...extra});
const need=(paras,w,font=17)=>textHeight(paras,Math.max(40,w-22),font,{leading:120})+Math.max(0,paras.length-1)*5+16;

export function compileRelationship({b,compositionId:id,bounds,groups,figures,options,fail}){
 const [x,y,w,h]=bounds,gap=options.gap??28;
 const evidence=()=>{if(!options.relationEvidence?.sourceIds?.length||!options.relationEvidence?.kind)fail('RELATION_EVIDENCE_REQUIRED',{compositionId:id});};
 const text=(g,box,{heading=true}={})=>{
  const value=heading?[g.heading,...g.paras]:g.paras;
  if(need(value,box[2])>box[3])fail('RELATION_TEXT_CAPACITY_EXCEEDED',{moduleId:g.id,needed:need(value,box[2]),available:box[3]});
  const o=b.op('materials-text',box,{body:value},{body:opts(box,17,{emphasis:heading?[{text:g.heading,color:BLUE,bold:true}]:[]})});b.route(g,o);return o;
 };
 const linked=(anchor,members,box,task,modules)=>b.contentGroups.push({id:anchor.id+'-relation',task,relation:task,anchorId:anchor.id,memberIds:members.map(o=>o.id),moduleIds:modules.map(g=>g.id),bounds:box});
 const pics=(items,box,vertical=false)=>{
  const [fx,fy,fw,fh]=box;
  items.forEach((f,i)=>b.figure({...f,imageAlign:'center'},vertical?[fx,fy+i*(fh+gap)/items.length,fw,(fh-gap*(items.length-1))/items.length]:[fx+i*(fw+gap)/items.length,fy,(fw-gap*(items.length-1))/items.length,fh]));
 };
 if(id==='timeline-with-evidence'){
  evidence();if(groups.some(g=>!g.date))fail('TIMELINE_DATES_REQUIRED');
  const fields={},textOptions={},boxes={},col=(w-48)/3,headH=Math.max(...groups.map(g=>need([g.heading,...g.paras],col-24)))+75;
  if(headH>h-185)fail('TIMELINE_EVIDENCE_CAPACITY_EXCEEDED');
  const dateIds=['93','95','97'],bodyIds=['94','96','98'];
  groups.forEach((g,i)=>{const xx=x+12+i*(w/3);fields['date'+i]=g.date;fields['body'+i]=[g.heading,...g.paras];
   textOptions['date'+i]=opts([xx,y+6,col,32],18,{color:BLUE,bold:true,align:'ctr'});
   textOptions['body'+i]=opts([xx,y+64,col,headH-70]);
   boxes[dateIds[i]]=textOptions['date'+i].box;boxes[bodyIds[i]]=textOptions['body'+i].box;
   boxes[['48','65','66'][i]]=[xx+col/2-5,y+46,10,10];});
  boxes['47']=[x+10,y+51,w-20,.2];
  const o=b.op('materials-timeline-three',[x,y,w,headH],fields,textOptions,{objectBoxes:boxes});groups.forEach((g,i)=>b.route(g,o,'body'+i));
  pics(figures,[x,y+headH+20,w,h-headH-20]);return;
 }
 if(['numbered-with-evidence','classified-with-evidence'].includes(id)){
  const left=options.textWidth??690,pw=w-left-gap;
  if(left<590||pw<300)fail('RELATION_REGION_TOO_NARROW');
  const height=Math.max(...groups.map(g=>id.startsWith('numbered')?need(g.paras,left-75)+44:need(g.paras,left-150)));
  const rh=Math.max(id.startsWith('numbered')?100:105,height)+(id.startsWith('classified')?12:0),total=rh*groups.length+20*(groups.length-1);
  if(total>h)fail('RELATION_STACK_CAPACITY_EXCEEDED',{needed:total,available:h});
  const yy=y+(h-total)/2;
  const rowOperations=[];groups.forEach((g,i)=>{
   const gy=yy+i*(rh+20);let o;
   if(id.startsWith('numbered'))o=b.op('materials-circle-numbered-row',[x,gy,left,rh],{number:String(i+1),heading:g.heading,body:g.paras},{number:{font:18,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr'},heading:opts([x+66,gy,left-70,35],19,{color:BLUE,bold:true}),body:opts([x+66,gy+43,left-70,rh-43])},{objectBoxes:{'77':[x+2,gy+2,43.3,50.4]}});
   else{
    if(g.heading.length>8)fail('CLASSIFICATION_LABEL_TOO_LONG',{moduleId:g.id});
    o=b.op('materials-hexagon-explanation',[x,gy,left,rh],{label:g.heading,body:g.paras},{label:{font:17,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr'},body:opts([x+146,gy+6,left-152,rh-12])},{objectBoxes:{'49':[x,gy+2,122,100]}});
   }
   b.route(g,o);
   rowOperations.push(o);
  });
  pics(figures,[x+left+gap,y,pw,h],true);
  if(figures.length===1&&id.startsWith('numbered'))b.pairedRegions.push({id:'numbered-picture',frameOperationId:b.supportFigures[0].frameOperationId,groups:rowOperations.map(o=>({operationIds:[o.id],start:{operationId:o.id,slot:'heading'},end:{operationId:o.id,slot:'body'}}))});
  return;
 }
 if(id==='merge-with-evidence'){
  evidence();const inputs=groups.filter(g=>g.role==='input'),result=groups.filter(g=>g.role==='result');
  if(inputs.length!==2||result.length!==1)fail('MERGE_ROLES_REQUIRED');
  if(groups.some(g=>g.heading.length>18))fail('MERGE_HEADING_TOO_LONG');
  const rw=options.relationshipWidth??740;if(w-rw-gap<300)fail('RELATION_REGION_TOO_NARROW');
  if((options.notesPlacement||'below')==='below'){
   const paragraphs=groups.flatMap(g=>g.paras),noteH=need(paragraphs,w)+Math.max(0,paragraphs.length-1)*8+8;
   const topH=Math.min(options.topHeight??240,h-noteH-36);
   if(topH<175)fail('MERGE_SHARED_NOTES_CAPACITY_EXCEEDED',{noteHeight:noteH,availableHeight:h});
   const a=b.op('materials-two-input-merge',[x,y,rw,topH],{input0:inputs[0].heading,input1:inputs[1].heading,result:result[0].heading},{input0:{font:18,bold:true,color:BLUE,align:'ctr',vAlign:'ctr'},input1:{font:18,bold:true,color:BLUE,align:'ctr',vAlign:'ctr'},result:{font:18,bold:true,color:BLUE,align:'ctr',vAlign:'ctr'}});
   const noteBox=[x+14,y+topH+34,w-20,noteH],tid=options.bullet||'human-dot-notes';
   if(!['human-dot-notes','human-square-notes','human-check-notes'].includes(tid))fail('MERGE_NOTES_SYMBOL_UNSUPPORTED');
   const note=b.op(tid,noteBox,{body:paragraphs},{body:opts(noteBox,17,{bullet:'source',bold:false,labelBold:false,paragraphAfter:8})});
   groups.forEach(g=>b.route(g,note));linked(a,[note],[x,y,w,topH+34+noteH],'merge',groups);
   const fw=w-rw-gap,cap=figures.some(f=>f.captionPolicy!=='none')?43:0;
   const adjusted=figures.length===1?figures.map(f=>{const[d0,d1]=f.dimensions||[4,3];const crop=f.imageCrop||[0,0,0,0],aspect=d0*(1-crop[0]-crop[2])/(d1*(1-crop[1]-crop[3]));const width=Math.min(fw,(topH-8)*aspect+8);return{f,box:[x+rw+gap+(fw-width)/2,y,width,topH+cap]};}):figures.map((f,i)=>({f,box:[x+rw+gap,y+i*(topH+cap)/figures.length,fw,(topH+cap)/figures.length]}));
   adjusted.forEach(({f,box})=>b.figure({...f,imageAlign:'left-top'},box));
   if(figures.length===1)b.pairedRegions.push({id:'merge-picture',frameOperationId:b.supportFigures[0].frameOperationId,bottomRequired:true,groups:[{operationIds:[a.id],start:{operationId:a.id},end:{operationId:a.id}}]});
   b.contentRegions.push({id:'shared-notes',kind:'unordered-notes',operationIds:[note.id],bounds:noteBox});
   return;
  }
  const mergeW=rw-70,mergeH=mergeW*1185268/4747578;
  const a=b.op('materials-two-input-merge',[x+35,y+10,mergeW,mergeH],{input0:inputs[0].heading,input1:inputs[1].heading,result:result[0].heading},{input0:{font:18,bold:true,color:BLUE,align:'ctr',vAlign:'ctr'},input1:{font:18,bold:true,color:BLUE,align:'ctr',vAlign:'ctr'},result:{font:18,bold:true,color:BLUE,align:'ctr',vAlign:'ctr'}});
  const bodyY=y+mergeH+40,col=(rw-24)/2,inputH=Math.max(...inputs.map(g=>need([g.heading,...g.paras],col)))+2;
  const members=inputs.map((g,i)=>text(g,[x+i*(col+24),bodyY,col,inputH],{heading:false}));
  const out=text(result[0],[x,bodyY+inputH+20,rw,h-(bodyY-y)-inputH-20],{heading:false});members.push(out);
  linked(a,members,[x,y,rw,h],'merge',groups);
  pics(figures,[x+rw+gap,y,w-rw-gap,h],true);return;
 }
 if(id==='branch-with-evidence'){
  const core=groups.filter(g=>g.role==='core'),details=groups.filter(g=>g.role==='detail');
  if(core.length!==1||details.length!==groups.length-1)fail('BRANCH_ROLES_REQUIRED');
  const rw=options.relationshipWidth??790,coreW=options.coreWidth??230,detailX=x+coreW+56,detailW=rw-coreW-56;
  if(detailW<350||w-rw-gap<280)fail('RELATION_REGION_TOO_NARROW');
  const ch=need([core[0].heading,...core[0].paras],coreW-22)+40,cy=y+(h-ch)/2;
  const box=[x,cy,coreW,ch],cb=[x+12,cy+12,coreW-24,ch-24];
  const c=b.op('materials-outline-condition',box,{body:[core[0].heading,...core[0].paras]},{body:opts(cb,17,{emphasis:[{text:core[0].heading,color:BLUE,bold:true}]})},{objectBoxes:{'90':box,'91':cb}});b.route(core[0],c);
  const hh=Math.max(...details.map(g=>need([g.heading,...g.paras],detailW))),total=hh*details.length+24*(details.length-1);
  if(total>h)fail('BRANCH_CAPACITY_EXCEEDED');
  const sy=y+(h-total)/2,a=b.op('materials-brace-group',[x+coreW+15,sy+4,28,total-8]);
  const members=details.map((g,i)=>text(g,[detailX,sy+i*(hh+24),detailW,hh]));
  linked(a,members,[x+coreW+10,sy,rw-coreW-10,total],'total-detail',details);
  pics(figures,[x+rw+gap,y,w-rw-gap,h],true);
  if(figures.length===1)b.pairedRegions.push({id:'branch-picture',frameOperationId:b.supportFigures[0].frameOperationId,decorationIds:[a.id],centerOperationIds:[c.id],groups:members.map(o=>({operationIds:[o.id],start:{operationId:o.id,slot:'body'},end:{operationId:o.id,slot:'body'}}))});
  return;
 }
 if(id==='cycle-with-evidence'){
  evidence();const edges=options.relationEvidence.edges||[],ids=groups.map(g=>g.id);
  if(edges.length!==3||ids.some(id=>edges.filter(e=>e[0]===id).length!==1||edges.filter(e=>e[1]===id).length!==1)||edges.some(e=>!ids.includes(e[0])||!ids.includes(e[1])||e[0]===e[1]))fail('CYCLE_EDGES_NOT_CLOSED');
  const rw=options.relationshipWidth??770;
  if(w-rw-gap<300)fail('RELATION_REGION_TOO_NARROW');
  const size=280,a=b.op('materials-cycle-three',[x+(rw-size)/2,y+80,size,size],{center:options.center||'资源回用'},{center:{font:20,bold:true,color:'FFFFFF',align:'ctr',vAlign:'ctr'}});
  const positions=[[x,y+10,210,165],[x+rw-210,y+10,210,165],[x+150,y+365,rw-300,115]];
  const members=groups.map((g,i)=>text(g,positions[i]));linked(a,members,[x,y,rw,h],'cycle',groups);
  pics(figures,[x+rw+gap,y,w-rw-gap,h]);return;
 }
 if(['matrix-with-evidence','response-with-evidence'].includes(id)){
  const matrix=id==='matrix-with-evidence',headers=options.matrixHeaders||(matrix?null:['问题类型','具体表现','改进方向']),cols=matrix?5:3;
  if(!headers||headers.length!==cols||groups.some(g=>g.paras.length!==cols-1))fail('MATRIX_FIELDS_REQUIRED');
  const tb=matrix?[x,y,options.tableWidth??830,h]:[x,y,w,options.tableHeight??255];
  const weights=options.tableColumnWeights||(matrix?[1.1,1.1,2.15,1.05,3.0]:[1.3,3,4]);
  const rows=groups.length+1,rowWeights=matrix?[.8,1,1,1,1,1]:[.65,1,1];
  const values=[headers,...groups.map(g=>[g.heading,...g.paras])],fields={},textOptions={};
  const sum=weights.reduce((a,v)=>a+v,0),rs=rowWeights.reduce((a,v)=>a+v,0);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const width=tb[2]*weights[c]/sum,height=tb[3]*rowWeights[r]/rs;
   const cellNeed=textHeight([values[r][c]],width-20,r?17:18,{leading:118,padding:0})+14;
   if(cellNeed>height)fail('MATRIX_CELL_CAPACITY_EXCEEDED',{row:r,column:c,needed:cellNeed,available:height});
   const slot=`cell${r}_${c}`;fields[slot]=values[r][c];textOptions[slot]={font:r?17:18,bold:!r,color:r?INK:BLUE,align:r?'l':'ctr',vAlign:r?'t':'ctr',inset:7,leading:106,paragraphAfter:0};
  }
  const a=b.op(matrix?'human-comparison-table':'human-response-table',tb,fields,textOptions,{tableColumnWeights:weights,tableRowWeights:rowWeights});
  groups.forEach((g,i)=>b.bindings.push({kind:'group',moduleId:g.id,operationId:a.id,slots:g.paras.map((_,j)=>`cell${i+1}_${j+1}`),bounds:[tb[0],tb[1]+tb[3]*rowWeights.slice(0,i+1).reduce((a,b)=>a+b,0)/rs,tb[2],tb[3]*rowWeights[i+1]/rs]}));
  groups.forEach((g,i)=>g.paras.forEach((t,j)=>b.contentRouting.push({id:a.id+'-'+i+'-'+j,sourceIds:g.sourceIds||[],importance:'key',destination:'body',target:{operationId:a.id,slot:`cell${i+1}_${j+1}`},visibleText:t})));
  if(matrix)pics(figures,[x+tb[2]+gap,y,w-tb[2]-gap,h],true);
  else pics(figures,[x,y+tb[3]+22,w,h-tb[3]-22]);return;
 }
 fail('RELATION_COMPOSITION_UNKNOWN',{compositionId:id});
}

/** The same checks also run for direct native operations and exported PPTX evidence. */
export function auditRelationshipEvidence(plan){
 const issues=[];
 for(const p of plan.pages||[]){
  if(p.role!=='content')continue;
  const types=new Set((p.operations||[]).map(o=>o.typeId)),proof=p.compositionOptions?.relationEvidence||p.relationEvidence;
  if((p.contentRegions||[]).some(r=>r.kind==='mixed-region')){
   for(const o of (p.operations||[]).filter(o=>o.typeId==='materials-two-input-merge')){
    const e=o.relationEvidence;
    if(e?.kind!=='merge'||!e.sourceIds?.length||e.sourceIds.some(id=>!(p.sourceIds||[]).includes(id)))issues.push({code:'RELATION_EVIDENCE_REQUIRED',pageId:p.id,operationId:o.id,required:'merge'});
   }
   continue;
  }
  const requirement=types.has('materials-cycle-three')?'cycle':types.has('materials-timeline-three')?'temporal':types.has('materials-two-input-merge')?'merge':null;
  if(!requirement)continue;
  const allowed=requirement==='merge'?['merge','collaboration']: [requirement];
  if(!allowed.includes(p.relation))issues.push({code:'NATIVE_RELATION_MISMATCH',pageId:p.id,required:allowed,actual:p.relation});
  if(!proof?.sourceIds?.length||proof.sourceIds.some(id=>!(p.sourceIds||[]).includes(id))||!allowed.includes(proof.kind))issues.push({code:'RELATION_EVIDENCE_REQUIRED',pageId:p.id,required:requirement});
  if(requirement==='cycle'){
   const ids=(p.modules||[]).map(g=>g.id),edges=proof?.edges||[];
   if(ids.length!==3||edges.length!==3||ids.some(id=>edges.filter(e=>e[0]===id).length!==1||edges.filter(e=>e[1]===id).length!==1)||edges.some(e=>!ids.includes(e[0])||!ids.includes(e[1])||e[0]===e[1]))issues.push({code:'CYCLE_EDGES_NOT_CLOSED',pageId:p.id});
  }
 }
 return {pass:!issues.length,issues};
}
