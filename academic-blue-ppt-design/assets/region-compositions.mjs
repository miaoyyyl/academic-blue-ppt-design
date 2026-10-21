/** Reusable region topologies; leaf placement clones only authorized bank objects. */
import {textHeight} from './narrative-layout.mjs';
import {auditRegions,REGION_FRAME,unionRegion} from './region-policy.mjs';
import {polishNativeOperation} from './component-polish.mjs';
import {measureSpatialPage,auditSpatialLayout,moveLayout} from './spatial-layout.mjs';
import {referenceCatalog,referencePresets,auditReferenceLayouts} from './reference-layouts.mjs';
const INK='162B40',BLUE='004BAD';
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
const measure=(p,w)=>Math.ceil(textHeight(p,Math.max(40,w-18),17,{leading:122,padding:0})+Math.max(0,p.length-1)*6+14);
const sourceTypes=[REGION_FRAME,'materials-inset-note','materials-folded-tab','materials-gradient-tab','materials-paper-image','materials-flow-step','materials-flow-arrow','materials-two-input-merge','materials-side-label'];
export const regionCatalog=[
 {id:'mixed-evidence-regions',name:'多区域证据串联',relations:['parallel','evidence','total-detail','causal','process'],groups:[2,8],figures:[0,8],task:'multi-region-evidence',use:'多个完整的图文区域共同支撑判断，区内图数由其职责决定。'},
 {id:'method-and-stacked-results',name:'方法与分层结果',relations:['total-detail','evidence','process'],groups:[3,8],figures:[1,8],task:'method-results',use:'一个完整方法区域与两个分层结果区域对应。'},
 {id:'principle-and-method-regions',name:'原理与方法局部解释',relations:['total-detail','causal','evidence','parallel'],groups:[2,8],figures:[1,6],task:'principle-method',use:'概念或原理与方法证据及局部说明共同解释同一问题。'},
 {id:'images-definitions-local-flow',name:'多图、定义与局部过程',relations:['total-detail','process','causal'],groups:[3,9],figures:[1,6],task:'definitions-and-process',use:'同页保留图组、编号解释与有依据的局部过程。'},
 {id:'multipart-figure-callouts',name:'复合图定位解读',relations:['evidence','total-detail','parallel'],groups:[2,7],figures:[1,3],task:'multipart-interpretation',use:'说明绑定整体图中的不同阅读子区，条件和结论置于同一区域。'},
 {id:'idea-and-route-lanes',name:'整体思路与技术路线',relations:['process','causal','flow','total-detail'],groups:[5,10],figures:[0,4],task:'idea-and-route',use:'整体思路与实施步骤分层呈现，汇合和反馈须有材料依据。'},
].map(c=>({...c,sourceTypes,slots:['语义区域树','区域内图文及局部关系','有来源的跨区连线'],adjustable:['区域权重','局部图文顺序','图数与阅读尺寸','标题及局部说明组件'],avoid:'按图数强造关系、缩小至不可读、空外框代替有效内容。'})).concat(referenceCatalog);
export const isRegionComposition=id=>regionCatalog.some(c=>c.id===id);

/** Presets organize semantics; explicit relative regions refine a compatible topology. */
function defaultRegions(id,groups,figures){
 const mk=(name,ms,rect,kind='evidence',extra={})=>({id:name,purpose:ms.map(m=>m.heading).join('；'),heading:ms[0]?.heading||name,moduleIds:ms.map(m=>m.id),figureIds:figures.filter(f=>f.claimModuleIds?.some(m=>ms.some(g=>g.id===m))).map(f=>f.id),rect,kind,...extra});
 if(id==='idea-and-route-lanes')return[mk('idea',groups.slice(0,3),[0,0,1,.48],'merge',{sideLabel:'整体思路'}),mk('route',groups.slice(3),[0,.52,1,.48],'flow',{sideLabel:'技术路线'})];
 if(id==='method-and-stacked-results')return[mk('method',[groups[0]],[0,0,.34,1]),mk('result-a',[groups[1]],[.38,0,.62,.47]),mk('result-b',groups.slice(2),[.38,.53,.62,.47])];
 if(id==='images-definitions-local-flow')return[mk('objects',[groups[0]],[0,0,.36,1], 'evidence',{layout:'image-top'}),mk('definition',[groups[1]],[.40,0,.60,.44],'numbered'),mk('local-process',groups.slice(2),[.40,.50,.60,.50],'flow')];
 if(id==='multipart-figure-callouts')return[mk('research',groups,[0,0,1,1],'callouts')];
 if(id==='principle-and-method-regions')return[mk('principle',[groups[0]],[0,0,.36,1],'evidence',{headingStyle:'folded'}),mk('method',groups.slice(1),[.40,0,.60,1],'evidence',{layout:'figure-left'})];
 const n=groups.length;if(n===2)return groups.map((g,i)=>mk('region-'+i,[g],[i*.52,0,.48,1]));
 if(n===3)return[mk('region-0',[groups[0]],[0,0,.48,.47]),mk('region-1',[groups[1]],[.52,0,.48,.47]),mk('region-2',[groups[2]],[0,.53,1,.47])];
 return groups.map((g,i)=>mk('region-'+i,[g],[(i%2)*.52,Math.floor(i/2)/Math.ceil(n/2),.48,1/Math.ceil(n/2)-.035]));
}

export function compileRegions({compositionId,bounds=[44,110,1192,547],groups=[],figures=[],regions,edges=[],options={},assets={},pageId='regional'},compileFigure){
 const recipe=regionCatalog.find(c=>c.id===compositionId),state={operations:[],contentGroups:[],supportFigures:[],bindings:[],contentRouting:[],contentRegions:[],relationEdges:[],referenceEdges:[],pairedRegions:[],spatialLanes:[]};
 const error=(code,d={})=>{const e=new Error(code);e.details=d;throw e;};
 const byModule=new Map(groups.map(g=>[g.id,g])),byFigure=new Map(figures.map(f=>[f.id,f]));
 const bodySources=[...new Set(groups.flatMap(g=>g.sourceIds||[]))];
 let serial=0;
  const op=(typeId,b,fields={},textOptions={},extra={})=>{const o=polishNativeOperation({id:pageId+'-r-'+serial++,typeId,bounds:b,fields,textOptions,...extra});state.operations.push(o);return o;};
 const txt=(paras,b,extra={})=>op('materials-text',b,{body:paras},{body:{box:b,font:17,color:INK,align:'l',vAlign:'t',leading:112,paragraphAfter:5,inset:0,...extra}});
 function route(g,o,slot='body',value=g.paras){const existing=state.bindings.find(b=>b.kind==='group'&&b.moduleId===g.id&&b.operationId===o.id);if(existing){existing.slots=[...new Set([...(existing.slots||[existing.slot]),slot])];delete existing.slot;}else state.bindings.push({kind:'group',moduleId:g.id,operationId:o.id,slot,bounds:o.textOptions?.[slot]?.box||o.bounds});for(const t of (Array.isArray(value)?value:[value]))state.contentRouting.push({id:o.id+'-'+state.contentRouting.length,sourceIds:g.sourceIds||[],importance:'key',destination:'body',target:{operationId:o.id,slot},visibleText:t});}
 function note(g,b,inset=false){const hh=measure(g.paras,b[2]-24);if(hh>b[3]+1)error('REGION_TEXT_CAPACITY',{moduleId:g.id,needed:hh,available:b});
  if(inset){const o=op('materials-inset-note',[...b.slice(0,3),hh+20],{body:g.paras},{body:{box:[b[0]+12,b[1]+10,b[2]-24,hh],font:17,color:INK,align:'l',vAlign:'t',leading:112}},{objectBoxes:{'125':[...b.slice(0,3),hh+20]},semanticRole:'local-annotation'});route(g,o);return o;}
  const o=txt(g.paras,[...b.slice(0,3),hh]);route(g,o);return o;
 }
 function picture(f,b,regionId){const result=compileFigure({figure:f,bounds:b,assets,scope:pageId+'-'+regionId+'-'+f.id});
  for(const o of result.operations)if(o.typeId!=='human-figure-frame-solid'&&o.typeId!=='materials-figure-frame-dashed')state.operations.push({...o,regionId});
  const sf=result.supportFigure;sf.regionId=regionId;state.supportFigures.push(sf);state.bindings.push({kind:'figure',figureId:sf.id,operationId:sf.operationId,assetId:sf.assetId,requestedBounds:b,displayBounds:state.operations.find(o=>o.id===sf.operationId).bounds});
  const po=state.operations.find(o=>o.id===sf.operationId),min=f.minimumDisplay||{};
  if((min.width&&po.bounds[2]<min.width)||(min.height&&po.bounds[3]<min.height))error('REGION_FIGURE_READING_SIZE',{figureId:f.id,actual:po.bounds,minimum:min});
  for(const t of f.readingTargets||[])if(t.minimumWidthPx&&po.bounds[2]*t.rect[2]/(1-(f.imageCrop?.[0]||0)-(f.imageCrop?.[2]||0))<t.minimumWidthPx)error('REGION_READING_TARGET_TOO_SMALL',{figureId:f.id,target:t.name});
  return po;
 }
 function rowsOfPictures(fs,b,rid){if(!fs.length)return;const cols=Math.min(fs.length,options.maxFiguresPerRow||2),rows=Math.ceil(fs.length/cols),gap=14,cw=(b[2]-gap*(cols-1))/cols,ch=(b[3]-gap*(rows-1))/rows;
  if(cw<90||ch<85)error('REGION_FIGURE_CAPACITY',{regionId:rid,available:b});
  fs.forEach((f,i)=>picture(f,[b[0]+(i%cols)*(cw+gap),b[1]+Math.floor(i/cols)*(ch+gap),cw,ch],rid));
 }
 function connect(from,to,kind,box,sourceIds,flipH=false){if(!sourceIds?.length)error('REGION_RELATION_EVIDENCE_REQUIRED');
  const e={id:pageId+'-edge-'+state.relationEdges.length,kind,fromOperationId:from.id,toOperationId:to.id,sourceIds:[...new Set(sourceIds)]};
  const o=op(kind==='feedback'?'materials-feedback-return':'materials-flow-arrow',box,{}, {},{relationEdge:e,nativeTransform:flipH?{flipH:true}:undefined});e.operationId=o.id;state.relationEdges.push(e);return o;
 }
 function referenceLink(from,to,kind,box,sourceIds){
  const types={explanation:'materials-chevron-link',upward:'materials-upward-link',inwardRight:'materials-inward-right',inwardLeft:'materials-inward-left'};
  const sources=sourceIds||options.relationEvidence?.sourceIds||bodySources;
  if(!sources?.length)error('REFERENCE_RELATION_EVIDENCE_REQUIRED');
  const o=op(types[kind],box);state.referenceEdges.push({kind,operationId:o.id,fromOperationId:from.id,toOperationId:to.id,sourceIds:sources});return o;
 }
 function keywords(ms,b,regionId,type='materials-dashed-keyword'){
  const gap=14,nh=Math.min(60,(b[3]-gap*(ms.length-1))/ms.length);
  if(nh<44)error('REFERENCE_KEYWORD_CAPACITY');
  return ms.map((g,i)=>{const label=[g.heading,...g.paras].join('：'),nw=type==='materials-compact-label'?Math.min(b[2],Math.ceil([...label].reduce((s,c)=>s+(/[\u2E80-\u9FFF\uFF00-\uFFEF]/u.test(c)?1:.63),0)*24+36)):b[2],bb=[b[0]+(b[2]-nw)/2,b[1]+i*(nh+gap),nw,nh];
   if(textHeight([label],bb[2]-28,18,{leading:108})>nh-12)error('REFERENCE_KEYWORD_CAPACITY',{moduleId:g.id});
   const o=op(type,bb,{label},{label:{box:[bb[0]+14,bb[1]+6,bb[2]-28,nh-12],font:18,color:BLUE,bold:true,align:'ctr',vAlign:'ctr',leading:108,inset:0}},{objectBoxes:{[type==='materials-compact-label'?'123':'65']:bb},regionId});route(g,o,'label',label);return o;
  });
 }
 function freePictures(fs,b,rid){
  const gap=16,cw=(b[2]-gap*(fs.length-1))/fs.length;
  for(const[fidx,f]of fs.entries()){
   const cell=[b[0]+fidx*(cw+gap),b[1],cw,b[3]],result=compileFigure({figure:f,bounds:cell,assets,scope:pageId+'-'+rid+'-'+f.id});
   const image=result.operations.find(o=>o.typeId==='materials-paper-image');
   if(image.bounds[2]<(f.minimumDisplay?.width||64)||image.bounds[3]<(f.minimumDisplay?.height||64))error('REGION_FIGURE_READING_SIZE');
   state.operations.push(...result.operations);state.supportFigures.push(result.supportFigure);state.bindings.push(result.binding);
  }
 }
 function renderRegion(r,parentBounds,parentId=null,depth=0){
  if(depth>2||!r.id||!r.purpose?.trim()||!r.heading?.trim()||!valid(r.rect)||r.rect.some(v=>v<0)||r.rect[0]+r.rect[2]>1.001||r.rect[1]+r.rect[3]>1.001)error('REGION_SPEC_INVALID',{regionId:r.id});
  if(state.contentRegions.some(v=>v.id===r.id))error('REGION_DUPLICATE_ID',{regionId:r.id});
  const b=[parentBounds[0]+r.rect[0]*parentBounds[2],parentBounds[1]+r.rect[1]*parentBounds[3],r.rect[2]*parentBounds[2],r.rect[3]*parentBounds[3]];
  if(r.kind==='timeline'||r.kind==='figure-strip'){
   const start=state.operations.length,ms=r.moduleIds.map(id=>byModule.get(id)),fs=r.figureIds.map(id=>byFigure.get(id));
   if(r.kind==='figure-strip')freePictures(fs,b,r.id);
   else{
    if(ms.length!==4)error('REFERENCE_FOUR_MILESTONES_REQUIRED');
    const fields={},textOptions={},boxes={},cw=b[2]/4;
    ms.forEach((g,i)=>{const xx=b[0]+i*cw;fields['date'+i]=g.date;fields['body'+i]=g.heading+'：'+g.paras.join('；');
     const db=[xx,b[1],cw,30],tb=[xx+12,b[1]+52,cw-24,b[3]-52];
     if(textHeight(fields['body'+i],tb[2],17,{leading:105})>tb[3]-2)error('REFERENCE_TIMELINE_CAPACITY');
     textOptions['date'+i]={box:db,font:18,color:INK,bold:true,align:'ctr',vAlign:'ctr',inset:0};textOptions['body'+i]={box:tb,font:17,color:INK,align:'l',vAlign:'t',leading:105,paragraphAfter:0,inset:0};
     boxes[String(93+i*2)]=db;boxes[String(94+i*2)]=tb;boxes[['48','65','66','67'][i]]=[xx+cw/2-5,b[1]+36,10,10];
    });boxes['47']=[b[0],b[1]+41,b[2],.2];
    const o=op('materials-timeline-four',b,fields,textOptions,{objectBoxes:boxes});ms.forEach((g,i)=>route(g,o,'body'+i,fields['body'+i]));
   }
   state.contentRegions.push({id:r.id,kind:r.kind==='timeline'?'timeline-lane':'figure-strip',bounds:b,moduleIds:r.moduleIds,figureIds:r.figureIds,operationIds:state.operations.slice(start).map(o=>o.id)});return;
  }
  if(r.kind==='notes'&&!r.figureIds?.length&&!r.children?.length&&!r.keepAlignedFrame){
   const paras=(r.moduleIds||[]).flatMap(id=>byModule.get(id)?.paras||[]);
    b[3]=Math.min(b[3],measure(paras,b[2]-32)+(r.headingStyle==='folded'?86:72));
  }
  if(r.kind==='flow'&&!r.keepAlignedFrame){
   const ms=(r.moduleIds||[]).map(id=>byModule.get(id)),cw=(b[2]-32-(r.sideLabel?58:0)-27*(ms.length-1))/Math.max(1,ms.length);
   b[3]=Math.min(b[3],72+66+Math.max(...ms.map(g=>measure(g?.paras||[],cw-28)))+(r.feedback?40:0));
  }
  const start=state.operations.length,frame=op(REGION_FRAME,[b[0],b[1]+12,b[2],b[3]-12],{}, {},{regionId:r.id});
  const side=r.headingStyle==='side',bar=r.headingStyle==='bar',isRow=r.kind==='evidence-row';
  const titleWidth=side?44:isRow?b[2]*.60:bar?b[2]:Math.min(b[2]-26,Math.max(180,r.heading.length*27+38));if(!side&&r.heading.length*27>titleWidth-28)error('REGION_HEADING_CAPACITY',{regionId:r.id});
   const folded=r.headingStyle==='folded';
   const hb=side?[b[0],b[1]+12,44,b[3]-12]:[b[0]+(isRow?b[2]-titleWidth:folded?-14:bar?0:14),b[1],titleWidth,44],hs=side?'body':'heading';
   const heading=op(side?'materials-side-label':bar?'materials-panel-heading':folded?'materials-folded-tab':'materials-gradient-tab',hb,{[hs]:side?r.heading.split('').join('\n'):r.heading},{[hs]:{font:20,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr',box:side||bar?hb:[hb[0]+14,hb[1]+4,hb[2]-28,hb[3]-8],inset:0}},{regionId:r.id,semanticRole:side?'lane-label':'region-heading',...(folded?{headingAttachment:{frameOperationId:frame.id,side:'left',outset:14}}:{})});
  let ms=(r.moduleIds||[]).map(id=>byModule.get(id));const fs=(r.figureIds||[]).map(id=>byFigure.get(id));if(ms.some(g=>!g)||fs.some(f=>!f))error('REGION_MEMBER_UNKNOWN',{regionId:r.id});
  const footer=r.conclusionModuleId&&byModule.get(r.conclusionModuleId);if(r.conclusionModuleId&&!footer)error('REGION_CONCLUSION_UNKNOWN');
  if(footer)ms=ms.filter(g=>g!==footer);
   const headingSpace=Math.max(56,heading.bounds[3]+10);
   let inner=[b[0]+16,b[1]+headingSpace,b[2]-32,b[3]-headingSpace-16];
   if(side)inner=[b[0]+60,b[1]+24,b[2]-76,b[3]-40];
  const footerText=footer?footer.paras.join(''):null,footerH=footer?Math.max(48,textHeight([footerText],inner[2]-24,18,{leading:112})+12):0;
  if(footer)inner[3]-=footerH+14;
  if(r.sideLabel){const sb=[inner[0],inner[1],42,inner[3]];op('materials-side-label',sb,{body:r.sideLabel.split('').join('\n')},{body:{font:18,color:'FFFFFF',align:'ctr',vAlign:'ctr',box:sb}},{regionId:r.id,semanticRole:'lane-label'});inner=[inner[0]+58,inner[1],inner[2]-58,inner[3]];}
  const [x,y,w,h]=inner;if(h<30||w<120)error('REGION_INNER_CAPACITY',{regionId:r.id});
  if(r.kind==='keyword-evidence'){
   const keywordH=fs.length?Math.min(h*.62,ms.length*60+(ms.length-1)*14):h;
   keywords(ms,[x,y,w,keywordH],r.id);if(fs.length)rowsOfPictures(fs,[x,y+keywordH+14,w,h-keywordH-14],r.id);
  }else if(r.kind==='mechanism-inputs'){
   const m=ms.find(g=>g.role==='mechanism'),inputs=ms.filter(g=>g.role==='input');if(!m||inputs.length!==2||fs.length!==1)error('REFERENCE_MECHANISM_BINDING_REQUIRED');
   const po=picture(fs[0],[x+48,y,w-48,Math.min(h*.40,230)],r.id);
   const label=[x,po.bounds[1],36,po.bounds[3]];op('materials-side-label',label,{body:m.heading.split('').join('\n')},{body:{box:label,font:18,color:'FFFFFF',align:'ctr',vAlign:'ctr',inset:0}},{regionId:r.id,semanticRole:'lane-label'});
   const mb=[x,y+Math.min(h*.40,230)+10,w,measure(m.paras,w)],mo=note(m,mb);mo.regionId=r.id;
   const inputY=mb[1]+mo.bounds[3]+58;
   if(inputY+118>y+h)error('REFERENCE_MECHANISM_INPUT_CAPACITY');
   const nodes=keywords(inputs,[x,inputY,w,118],r.id,'materials-compact-label');
   // Two arrows share a destination, without implying a sequence between the inputs.
   referenceLink(nodes[0],po,'upward',[x+w/2-25,inputY-50,50,30]);
   state.referenceEdges.at(-1).fromOperationIds=nodes.map(o=>o.id);
  }else if(r.kind==='evidence-row'){
   if(ms.length!==1||fs.length!==1)error('REFERENCE_ROW_BINDING_REQUIRED');
   const po=picture(fs[0],[b[0]+12,b[1]+14,b[2]*.31,b[3]-28],r.id),tb=[hb[0]+12,hb[1]+52,hb[2]-24,b[3]-68],to=note(ms[0],tb);to.regionId=r.id;
   referenceLink(po,to,'explanation',[b[0]+b[2]*.335,b[1]+b[3]/2-12,b[2]*.055,24],ms[0].sourceIds);
  }else if(r.kind==='side-evidence'){
   if(fs.length!==1)error('REFERENCE_SIDE_FIGURE_REQUIRED');
   const paras=ms.flatMap(g=>g.paras),th=paras.some(t=>t.trim())?measure(paras,w):0;
   if(th>h*.34)error('REFERENCE_SIDE_TEXT_CAPACITY');
   rowsOfPictures(fs,[x,y,w,h-th-(th?12:0)],r.id);
   if(th){const o=txt(paras,[x,y+h-th,w,th]);o.regionId=r.id;ms.forEach(g=>route(g,o));}
  }else if(r.children?.length){for(const child of r.children)renderRegion(child,inner,r.id,depth+1);}
  else if(r.kind==='flow'){
   if(ms.length<2||ms.length>5)error('REGION_FLOW_NODE_COUNT');const gap=27,cw=(w-gap*(ms.length-1))/ms.length;
   const bh=Math.max(...ms.map(g=>measure(g.paras,cw-28))),hh=54+bh+12,feedback=r.feedback;
   if(hh+(feedback?40:0)>h)error('REGION_FLOW_CAPACITY',{needed:hh+(feedback?40:0),available:h});
   const nodes=ms.map((g,i)=>{const bb=[x+i*(cw+gap),y,cw,hh],o=op('materials-flow-step',bb,{heading:g.heading,body:g.paras},{heading:{box:[bb[0]+10,y+5,cw-20,34],font:20,color:'FFFFFF',bold:true,align:'ctr'},body:{box:[bb[0]+12,y+52,cw-24,bh],font:17,color:INK,align:'l',vAlign:'t',leading:112,paragraphAfter:5}},{objectBoxes:{'80':bb,'81':[bb[0],y,cw,44]},regionId:r.id});route(g,o);return o;});
   for(let i=1;i<nodes.length;i++)connect(nodes[i-1],nodes[i],'flow',[nodes[i-1].bounds[0]+cw+2,y+hh/2-13,gap-4,26],r.sourceIds||ms.flatMap(g=>g.sourceIds||[]));
   if(feedback){const fi=ms.findIndex(g=>g.id===feedback.fromId),ti=ms.findIndex(g=>g.id===feedback.toId);if(fi<0||ti<0||fi===ti)error('REGION_FEEDBACK_ENDPOINT_UNKNOWN');connect(nodes[fi],nodes[ti],'feedback',[x,y+hh+9,w,26],feedback.sourceIds,fi>ti);}
  }else if(r.kind==='merge'){
   if(ms.length!==3)error('REGION_MERGE_THREE_MODULES_REQUIRED');const compact=r.compact!==false,mh=compact?152:136;
   const values=ms.map(g=>compact?g.heading+'：'+g.paras.join(''):g.heading);
   if(mh>h||!compact&&mh+measure(ms.flatMap(g=>g.paras),w)>h||compact&&values.some((t,i)=>textHeight([t],i===2?w-20:w*.47-16,17,{leading:110})>54))error('REGION_MERGE_CAPACITY');
   const a=op('materials-two-input-merge',[x,y,w,mh],{input0:values[0],input1:values[1],result:values[2]},{input0:{font:17,color:BLUE,bold:true,align:'ctr',box:[x+8,y+5,w*.47-16,54]},input1:{font:17,color:BLUE,bold:true,align:'ctr',box:[x+w*.53,y+5,w*.47-8,54]},result:{font:17,color:BLUE,bold:true,align:'ctr',box:[x+10,y+mh-58,w-20,52]}},{regionId:r.id,relationEvidence:{kind:'merge',sourceIds:r.sourceIds||ms.flatMap(g=>g.sourceIds||[])}});
   if(!compact){let yy=y+mh+10;for(const g of ms){const o=note(g,[x,yy,w,y+h-yy]);yy+=o.bounds[3]+6;}}
   ms.forEach((g,i)=>route(g,a,['input0','input1','result'][i],compact?g.paras:g.heading));
  }else if(r.kind==='table'){
   if(ms.length!==5||r.tableHeaders?.length!==5||ms.some(g=>g.paras.length!==4))error('REGION_TABLE_FIELDS_REQUIRED');
   const weights=r.columnWeights||[1.1,1.8,2.5,2.2,2.8],rowWeights=[.7,1,1,1,1,1],sum=weights.reduce((a,b)=>a+b,0),sumRows=5.7,fields={},opts={};
   const values=[r.tableHeaders,...ms.map(g=>[g.heading,...g.paras])];
   for(let row=0;row<6;row++)for(let col=0;col<5;col++){
    const cw=w*weights[col]/sum,ch=h*rowWeights[row]/sumRows,need=textHeight([values[row][col]],cw-18,row?17:18,{leading:112,padding:0})+12;
    if(need>ch)error('REGION_TABLE_CELL_CAPACITY',{row,col,needed:need,available:ch});
    const key=`cell${row}_${col}`;fields[key]=values[row][col];opts[key]={font:row?17:18,color:row?INK:BLUE,bold:!row,align:row?'l':'ctr',vAlign:row?'t':'ctr',leading:106,inset:6,paragraphAfter:0};
   }
   const table=op('human-comparison-table',[x,y,w,h],fields,opts,{tableColumnWeights:weights,tableRowWeights:rowWeights,regionId:r.id});
   ms.forEach((g,i)=>g.paras.forEach((t,j)=>route(g,table,`cell${i+1}_${j+1}`,t)));
  }else if(r.kind==='callouts'){
   if(fs.length!==1||ms.length<2)error('REGION_CALLOUT_BINDINGS_REQUIRED');const col=w*.245,gw=w*.46,px=x+col+14;
   const assigned=new Set();for(const g of ms){if(!g.targetNames?.length||g.targetNames.some(name=>!fs[0].readingTargets?.some(t=>t.name===name)))error('REGION_CALLOUT_TARGET_REQUIRED',{moduleId:g.id});g.targetNames.forEach(n=>assigned.add(n));}
   const pic=picture(fs[0],[px,y,gw,h],r.id),crop=fs[0].imageCrop||[0,0,0,0];const sides=[ms.filter((_,i)=>i%2===0),ms.filter((_,i)=>i%2)];
   const targetY=g=>{const ts=g.targetNames.map(n=>fs[0].readingTargets.find(t=>t.name===n));return pic.bounds[1]+pic.bounds[3]*(ts.reduce((s,t)=>s+t.rect[1]+t.rect[3]/2,0)/ts.length-crop[1])/(1-crop[1]-crop[3]);};
   sides.forEach((list,j)=>{
    const entries=list.map(g=>{const copy={...g,paras:[g.heading+'：'+g.paras.join('')]};return{g,copy,h:measure(copy.paras,col-32)+20,center:targetY(g)};}).sort((a,b)=>a.center-b.center);
    if(entries.reduce((s,e)=>s+e.h,0)+Math.max(0,entries.length-1)*18>h)error('REGION_CALLOUT_CAPACITY');
    let yy=y;for(const e of entries){e.y=Math.max(yy,Math.min(y+h-e.h,e.center-e.h/2));yy=e.y+e.h+18;}
    const overflow=Math.max(0,yy-18-y-h);if(overflow)for(const e of entries)e.y-=overflow;
    for(const e of entries){const o=note(e.copy,[j?px+gw+14:x,e.y,col-8,e.h],true);o.annotationBinding={figureId:fs[0].id,moduleId:e.g.id,targetNames:e.g.targetNames};}
   });
  }else{
   const allParas=ms.flatMap(g=>ms.length===1?g.paras:[g.heading+'：'+g.paras.join('')]);
   if(!ms.length&&!fs.length)error('REGION_EMPTY_CONTAINER');
   if(r.kind==='numbered'){
    let yy=y;for(const [i,g]of ms.entries()){
     const nh=measure(g.paras,w-62),rowH=44+nh;
     if(yy+rowH>y+h)error('REGION_NUMBERED_CAPACITY');
     const o=op('materials-circle-numbered-row',[x,yy,w,rowH],{number:String(i+1),heading:g.heading,body:g.paras},{number:{font:19,color:'FFFFFF',align:'ctr',box:[x+1,yy+3,33,34]},heading:{font:20,color:BLUE,bold:true,box:[x+47,yy,w-47,37]},body:{font:17,color:INK,align:'l',vAlign:'t',leading:112,box:[x+47,yy+43,w-47,nh]}},{objectBoxes:{'77':[x,yy+1,35,38],'76':[x+47,yy,w-47,37],'89':[x+47,yy+43,w-47,nh]},regionId:r.id});route(g,o);yy+=rowH+14;
    }
   }else if(['figure-left','figure-right'].includes(r.layout)&&fs.length){
    const fw=r.figureShare??.49,gap=18,iw=(w-gap)*fw,tw=w-gap-iw,ix=r.layout==='figure-right'?x+tw+gap:x,tx=r.layout==='figure-right'?x:x+iw+gap;
    rowsOfPictures(fs,[ix,y,iw,h],r.id);let yy=y;for(const g of ms){const hh=measure(g.paras,tw-12),o=note(g,[tx,yy,tw,y+h-yy],r.insetNotes);yy+=o.bounds[3]+15;}
   }else if(r.layout==='image-top'&&fs.length){
    const th=measure(allParas,w),ih=h-th-16;if(ih<95)error('REGION_IMAGE_TEXT_CAPACITY');rowsOfPictures(fs,[x,y,w,ih],r.id);
    const o=txt(allParas,[x,y+ih+16,w,th]);ms.forEach(g=>route(g,o,'body',g.paras));
   }else{
    const th=allParas.length?measure(allParas,w):0,ih=h-th-(allParas.length?16:0);if(th>h||fs.length&&ih<90)error('REGION_TEXT_IMAGE_CAPACITY',{regionId:r.id,needed:th+106,available:h});
    if(allParas.length){const o=txt(allParas,[x,y,w,th]);ms.forEach(g=>route(g,o,'body',g.paras));}
    rowsOfPictures(fs,[x,y+th+(allParas.length?16:0),w,ih],r.id);
   }
  }
  if(footer){const fb=[b[0],b[1]+b[3]-footerH,b[2],footerH];const fo=op('materials-conclusion-strip',fb,{body:footerText},{body:{font:18,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr',box:[fb[0]+12,fb[1]+6,fb[2]-24,fb[3]-12]}},{semanticRole:'region-conclusion',objectBoxes:{'55':fb}});route(footer,fo,'body',footer.paras);}
  const ownOps=state.operations.slice(start),childRows=state.contentRegions.filter(v=>v.parentId===r.id),moduleIds=[...new Set([...(r.moduleIds||[]),...(footer?[footer.id]:[]),...childRows.flatMap(v=>v.moduleIds)])],figureIds=[...new Set([...(r.figureIds||[]),...childRows.flatMap(v=>v.figureIds)])];
  if(childRows.length&&!footer&&!r.keepAlignedFrame){const end=Math.max(...ownOps.filter(o=>o!==frame).map(o=>o.bounds[1]+o.bounds[3]));b[3]=Math.min(b[3],end-b[1]+16);frame.bounds=[b[0],b[1]+12,b[2],b[3]-12];}
  frame.regionContainer={regionId:r.id,purpose:r.purpose,moduleIds,figureIds,memberOperationIds:ownOps.filter(o=>o!==frame).map(o=>o.id)};
  const row={id:r.id,kind:'mixed-region',layout:r.layout||r.kind||'text-top',purpose:r.purpose,bounds:b,parentId,childIds:childRows.map(v=>v.id),frameOperationId:frame.id,headingOperationId:heading.id,operationIds:ownOps.map(o=>o.id),moduleIds,figureIds};state.contentRegions.push(row);
  for(const f of state.supportFigures.filter(f=>f.regionId===r.id)){f.frameOperationId=frame.id;f.frameStyle='region';f.frameScope='region';delete f.framePadding;}
 }
 try{
  if(!recipe)error('REGION_RECIPE_UNKNOWN');
  const preset=referencePresets(compositionId,groups,figures,options);
  const tree=regions?.length?regions:preset||defaultRegions(compositionId,groups,figures);
  for(const r of tree)renderRegion(r,bounds);
  if(compositionId==='questions-focus-evidence-strip'){
   const [l,c,r]=['established','research','planned'].map(id=>state.contentRegions.find(r=>r.id===id)),get=q=>state.operations.find(o=>o.id===q.headingOperationId);
   const cy=l.bounds[1]+l.bounds[3]/2;
   referenceLink(get(l),get(c),'inwardRight',[l.bounds[0]+l.bounds[2]+5,cy-17,c.bounds[0]-l.bounds[0]-l.bounds[2]-10,34]);
   referenceLink(get(r),get(c),'inwardLeft',[c.bounds[0]+c.bounds[2]+5,cy-17,r.bounds[0]-c.bounds[0]-c.bounds[2]-10,34]);
  }
  // Pack complete, non-overlapping root rows after intrinsic text height is known.
  // Staggered layouts (one tall column beside stacked regions) keep their lanes.
  const rootRows=[];
  for(const r of state.contentRegions.filter(r=>!r.parentId).sort((a,b)=>a.bounds[1]-b.bounds[1])){
   const row=rootRows.find(row=>Math.abs(row.y-r.bounds[1])<3);if(row)row.items.push(r);else rootRows.push({y:r.bounds[1],items:[r]});
  }
  if(rootRows.length>1&&rootRows.slice(0,-1).every((row,i)=>Math.max(...row.items.map(r=>r.bounds[1]+r.bounds[3]))<=rootRows[i+1].y+3)){
   const total=rootRows.reduce((s,row)=>s+Math.max(...row.items.map(r=>r.bounds[3])),0)+24*(rootRows.length-1);let cursor=bounds[1]+Math.max(0,bounds[3]-total)*.4;
   for(const row of rootRows){const height=Math.max(...row.items.map(r=>r.bounds[3]));for(const r of row.items)moveLayout(state,r.operationIds,0,cursor-r.bounds[1]);cursor+=height+24;}
  }
  for(const e of edges){const from=state.operations.find(o=>o.id===e.fromOperationId),to=state.operations.find(o=>o.id===e.toOperationId);if(!from||!to)error('REGION_CROSS_EDGE_ENDPOINT_REQUIRED');connect(from,to,e.kind,e.bounds,e.sourceIds,e.flipH);}
  const covered=new Set(state.contentRouting.filter(r=>r.destination==='body').flatMap(r=>r.sourceIds)),assigned=new Set(state.contentRegions.flatMap(r=>r.moduleIds));
  if(groups.some(g=>!assigned.has(g.id))||state.supportFigures.length!==figures.length||new Set(state.supportFigures.map(f=>f.id)).size!==figures.length)error('REGION_CONTENT_LOST_OR_DUPLICATED');
  const page={id:pageId,role:'content',compositionId,modules:groups,sourceIds:bodySources,compositionBounds:bounds,...state};const review=auditRegions({pages:[page]});if(!review.pass)error(review.issues[0].code,{issues:review.issues});
  const referenceReview=auditReferenceLayouts({pages:[page]});if(!referenceReview.pass)error(referenceReview.issues[0].code,{issues:referenceReview.issues});
  const spatial=measureSpatialPage(page);
  return {ok:true,compositionId,...state,regions:tree,usedBounds:bounds,availableBounds:bounds,occupiedBounds:spatial.occupiedBounds,spatialLayout:{version:1,placement:'regional',basis:'semantic region members; frame area does not count',...spatial},spatialReview:auditSpatialLayout({pages:[page]}),regionReview:review,recipe:{id:recipe.id,sourceTypes:recipe.sourceTypes},errors:[]};
 }catch(e){return {ok:false,compositionId,operations:[],errors:[{code:e.message,...e.details}],suggestions:['调整区域内正文与读图职责','更换区域或合并共同任务','确实无法容纳时拆页，不缩字']};}
}
