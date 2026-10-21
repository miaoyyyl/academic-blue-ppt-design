/** Four source-derived topologies, selected by semantic roles rather than picture count. */
const types=['materials-mixed-region-frame','materials-panel-heading','materials-dashed-keyword','materials-compact-label','materials-paper-image','materials-side-label','materials-timeline-four','materials-chevron-link','materials-upward-link','materials-inward-right','materials-inward-left'];
export const referenceCatalog=[
 {id:'theory-mechanism-application',name:'理论分组、输入机理与应用证据',task:'theory-to-application',relations:['total-detail','evidence'],groups:[7,7],figures:[3,3],use:'理论短点、两类输入与机理、应用解释各有独立职责和图证。',roles:'theory×3, input×2, mechanism×1, application×1'},
 {id:'perspectives-timeline-evidence',name:'四维说明、四节点时间轴与双图证',task:'perspectives-and-milestones',relations:['total-detail','evidence'],groups:[10,10],figures:[2,2],use:'四个并列视角、四个可核对阶段和两组图证共同介绍同一研究。',roles:'perspective×4, milestone×4, evidence×2'},
 {id:'evidence-rows-and-focus',name:'逐行小图映射与右侧综合证据',task:'findings-with-focus',relations:['evidence','total-detail'],groups:[3,5],figures:[3,5],use:'二至四条发现各有小图及解释，右侧保留一幅相关综合证据。',roles:'finding×2..4, core×1'},
 {id:'questions-focus-evidence-strip',name:'双侧问题汇入、中央研究内容与底部图证',task:'questions-and-research',relations:['total-detail','conditions'],groups:[6,10],figures:[4,4],use:'已开展和拟开展的问题分别关联中央研究内容，四幅小图作支撑。',roles:'established×2..4, focus×1..2, planned×2..4'},
].map(c=>({...c,sourceTypes:types,slots:['带角色与来源的模块','与模块绑定的图证','可选共同引领句'],adjustable:['区域宽度权重','正常字号内的正文容量','图像阅读尺寸与局部顺序'],avoid:'用箭头暗示未给出的因果、把拟开展工作当成成果、为套版增加无关图或重复综述。'}));
export function referencePresets(id,groups,figures,options){
 if(!referenceCatalog.some(c=>c.id===id))return null;
 const fail=code=>{throw Error(code);};
 const allowed={'theory-mechanism-application':['theory','input','mechanism','application'],'perspectives-timeline-evidence':['perspective','milestone','evidence'],'evidence-rows-and-focus':['finding','core'],'questions-focus-evidence-strip':['established','focus','planned']}[id];
 if(groups.some(g=>!allowed.includes(g.role)))fail('REFERENCE_UNKNOWN_ROLE');
 const role=(name,min,max=min)=>{const a=groups.filter(g=>g.role===name);if(a.length<min||a.length>max)fail('REFERENCE_ROLES_REQUIRED');return a;};
 const mk=(name,ms,rect,kind,extra={})=>({id:name,purpose:ms.map(g=>g.heading).join('；'),heading:ms[0]?.heading||'图证',moduleIds:ms.map(g=>g.id),figureIds:figures.filter(f=>f.claimModuleIds?.some(id=>ms.some(g=>g.id===id))).map(f=>f.id),rect,kind,headingStyle:'bar',...extra});
 let result;
 if(id==='theory-mechanism-application'){
  const t=role('theory',3),m=role('mechanism',1),i=role('input',2),a=role('application',1);
  if(!options.relationEvidence?.sourceIds?.length)fail('REFERENCE_RELATION_EVIDENCE_REQUIRED');
  result=[mk('theory',t,[0,0,.27,1],'keyword-evidence',{heading:options.theoryHeading||'基础问题'}),mk('mechanism',[...m,...i],[.294,0,.316,1],'mechanism-inputs',{heading:m[0].heading}),mk('application',a,[.634,0,.366,1],'evidence')];
 }else if(id==='perspectives-timeline-evidence'){
  const p=role('perspective',4),m=role('milestone',4),e=role('evidence',2);
  if(m.some(g=>!g.date)||!options.relationEvidence?.sourceIds?.length)fail('REFERENCE_MILESTONE_DATES_AND_SOURCE_REQUIRED');
  result=[...p.map((g,i)=>mk('perspective-'+i,[g],[i*.255,0,.235,.31],'notes',{keepAlignedFrame:true})),mk('milestones',m,[0,.35,1,.18],'timeline'),...e.map((g,i)=>mk('evidence-'+i,[g],[i*.515,.57,.485,.43],'side-evidence',{headingStyle:'side'}))];
 }else if(id==='evidence-rows-and-focus'){
  const rows=role('finding',2,4),core=role('core',1),gap=.035,rh=(1-gap*(rows.length-1))/rows.length;
  result=[...rows.map((g,i)=>mk('finding-'+i,[g],[0,i*(rh+gap),.60,rh],'evidence-row')),mk('focus',core,[.63,0,.37,1],'side-evidence',{headingStyle:'side'})];
 }else{
  const left=role('established',2,4),focus=role('focus',1,2),right=role('planned',2,4);
  if(!options.relationEvidence?.sourceIds?.length)fail('REFERENCE_RELATION_EVIDENCE_REQUIRED');
  result=[mk('established',left,[0,0,.25,.49],'keyword-evidence',{heading:options.establishedHeading||'已开展问题',figureIds:[]}),mk('research',focus,[.31,0,.38,.49],'evidence',{heading:options.focusHeading||'研究内容',figureIds:[]}),mk('planned',right,[.75,0,.25,.49],'keyword-evidence',{heading:options.plannedHeading||'拟开展问题',figureIds:[]}),mk('support',groups,[0,.55,1,.45],'figure-strip',{heading:'支撑图证',figureIds:figures.map(f=>f.id)})];
 }
 const assigned=new Set(result.flatMap(r=>r.moduleIds));if(groups.some(g=>!assigned.has(g.id)))fail('REFERENCE_UNKNOWN_ROLE');return result;
}

const contains=(a,b,t=3)=>a&&b&&b[0]>=a[0]-t&&b[1]>=a[1]-t&&b[0]+b[2]<=a[0]+a[2]+t&&b[1]+b[3]<=a[1]+a[3]+t;
/** Plan and exported-file checks use the actual linked objects, not a recipe-name exemption. */
export function auditReferenceLayouts(plan,{actualEvidence=false}={}){
 const issues=[],pages=[];
 for(const p of plan.pages||[]){
  if(!referenceCatalog.some(c=>c.id===p.compositionId))continue;
  const ops=new Map((p.operations||[]).map(o=>[o.id,o])),bb=o=>actualEvidence?o?._actualOperationBounds||o?.bounds:o?.bounds;
  const add=(code,d={})=>issues.push({code,pageId:p.id,...d});
  for(const e of p.referenceEdges||[]){
   const from=ops.get(e.fromOperationId),to=ops.get(e.toOperationId),link=ops.get(e.operationId);
   if(!from||!to||!link||!e.sourceIds?.length||e.sourceIds.some(s=>!p.sourceIds?.includes(s))){add('REFERENCE_EDGE_BINDING_INVALID');continue;}
   const a=bb(from),b=bb(to),c=bb(link);
   const expected={explanation:'materials-chevron-link',upward:'materials-upward-link',inwardRight:'materials-inward-right',inwardLeft:'materials-inward-left'}[e.kind];
   if(link.typeId!==expected)add('REFERENCE_EDGE_TYPE_INVALID');
   if(actualEvidence&&['inwardRight','inwardLeft'].includes(e.kind)&&!!link._actualNativeTransform?.flipH!==(e.kind==='inwardLeft'))add('ACTUAL_REFERENCE_ARROW_DIRECTION_INVALID');
   if(e.kind==='explanation'&&!(a[0]+a[2]<=c[0]+8&&c[0]+c[2]<=b[0]+8&&Math.abs((a[1]+a[3]/2)-(b[1]+b[3]/2))<42))add('REFERENCE_ROW_MAPPING_INVALID');
   if(e.kind==='upward'){
    if(!(a[1]>=c[1]+c[3]-12&&b[1]+b[3]<=c[1]+12))add('REFERENCE_UPWARD_GEOMETRY_INVALID');
    if(e.fromOperationIds?.length!==2||new Set(e.fromOperationIds).size!==2||e.fromOperationIds.some(id=>ops.get(id)?.typeId!=='materials-compact-label'))add('REFERENCE_TWO_INPUTS_REQUIRED');
   }
   if(e.kind==='inwardRight'&&!(a[0]+a[2]<=c[0]+10&&c[0]+c[2]<=b[0]+10))add('REFERENCE_INWARD_DIRECTION_INVALID');
   if(e.kind==='inwardLeft'&&!(b[0]+b[2]<=c[0]+10&&c[0]+c[2]<=a[0]+10))add('REFERENCE_INWARD_DIRECTION_INVALID');
  }
  const edgeCount=p.compositionId==='theory-mechanism-application'?1:p.compositionId==='evidence-rows-and-focus'?p.modules.filter(g=>g.role==='finding').length:p.compositionId==='questions-focus-evidence-strip'?2:0;
  if((p.referenceEdges||[]).length!==edgeCount)add('REFERENCE_RELATION_COUNT_INVALID');
  const figures=p.supportFigures||[];
  if(figures.length!==new Set(figures.map(f=>f.id)).size)add('REFERENCE_DUPLICATE_FIGURE');
  for(const r of (p.contentRegions||[]).filter(r=>['timeline-lane','figure-strip'].includes(r.kind))){
   if(!r.operationIds?.length||r.operationIds.some(id=>!contains(r.bounds,bb(ops.get(id)))))add('REFERENCE_LANE_MEMBER_OUTSIDE',{regionId:r.id});
  }
  if(p.compositionId==='perspectives-timeline-evidence'){
   const timeline=(p.operations||[]).find(o=>o.typeId==='materials-timeline-four');
   if(!timeline)add('REFERENCE_FOUR_NODE_TIMELINE_REQUIRED');
   else for(let i=0;i<4;i++){
    const fields=actualEvidence?timeline._actualFields:timeline.fields,boxes=actualEvidence?timeline._actualNativeBoxes:timeline.objectBoxes;
    const marker=boxes?.[['48','65','66','67'][i]],date=(actualEvidence?timeline._actualSlotBoxes:undefined)?.['date'+i]||timeline.textOptions['date'+i]?.box,body=(actualEvidence?timeline._actualSlotBoxes:undefined)?.['body'+i]||timeline.textOptions['body'+i]?.box;
    if(!fields?.['date'+i]||!fields?.['body'+i]||!marker||!date||!body||date[1]+date[3]>marker[1]+3||body[1]<marker[1]+marker[3]-3||Math.abs(marker[0]+marker[2]/2-date[0]-date[2]/2)>5)add('REFERENCE_TIMELINE_NODE_INVALID',{node:i});
    const line=boxes?.['47'];if(!line||!marker||Math.abs(line[1]+line[3]/2-marker[1]-marker[3]/2)>1)add('REFERENCE_TIMELINE_LINE_DETACHED',{node:i});
   }
  }
  if(p.compositionId==='questions-focus-evidence-strip'){
   const strip=p.contentRegions?.find(r=>r.kind==='figure-strip');
   if(!strip||strip.figureIds.length!==4||figures.some(f=>!strip.figureIds.includes(f.id)))add('REFERENCE_EVIDENCE_STRIP_INVALID');
  }
  pages.push({pageId:p.id,compositionId:p.compositionId,edges:edgeCount,figures:figures.length});
 }
 return {pass:!issues.length,issues,pages};
}
