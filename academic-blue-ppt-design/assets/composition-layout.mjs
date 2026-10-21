/** Semantic compositions of authorized native objects. No replacement drawing API. */
import {textHeight} from './narrative-layout.mjs';
import {normalizeImageCrop,imageDisplayGeometry} from './figure-policy.mjs';
import {balanceComposition,spatialGap,auditSpatialLayout} from './spatial-layout.mjs';
import {auditVisualPlan} from './visual-policy.mjs';
import {makeFigureFrame,combineFigureFrames,auditFigureFrames} from './figure-frame-policy.mjs';
import {relationshipCatalog,compileRelationship} from './relation-compositions.mjs';
import {structureSignature} from './layout-diversity.mjs';
import {findCases} from './native-components/api.mjs';
import {regionCatalog,isRegionComposition,compileRegions} from './region-compositions.mjs';
import {polishNativeOperation} from './component-polish.mjs';

const INK='162B40',BLUE='004BAD';
const peer=['parallel','comparison','classification'];
export const compositionCatalog=[
  {id:'peer-text-panels',name:'同层解释组',relations:peer,groups:[1,4],figures:[0,2],sourceTypes:['materials-gradient-tab','materials-filled-column','materials-badge-panel'],slots:['重复的标题与解释','可选下部图证区'],adjustable:['组数','标题样式','列间距','按正文收高'],use:'同层类别或方法需要在同页比较。',avoid:'带有先后或因果方向的链条。'},
  {id:'peer-figure-columns',name:'同层图文栏',relations:peer,groups:[2,4],figures:[2,4],sourceTypes:['materials-gradient-tab','materials-text','materials-paper-image'],slots:['同层标题','对应图片','解释'],adjustable:['共同图像行高','图文顺序','裁切'],use:'每一同层对象都有独立配图，槽位顺序共同。',avoid:'一张共享图被重复到所有栏目，或同一组图误绑不同命题。'},
  {id:'text-over-figures',name:'正文组与共享图组',relations:[...peer,'total-detail'],groups:[1,4],figures:[1,4],sourceTypes:['materials-filled-column','materials-gradient-tab','materials-paper-image'],slots:['上部论述组','下部共享图组'],adjustable:['正文所需高度','图组数量','各图宽度权重'],use:'图组共同补充上方论述，宽图适合横向展示。',avoid:'上部文字占满后仍把复杂图片挤成细条。'},
  {id:'figure-with-explanations',name:'主图与分组解释',relations:[...peer,'total-detail','causal'],groups:[1,4],figures:[1,1],sourceTypes:['human-left-label-band','materials-gradient-tab','materials-badge-panel','materials-paper-image'],slots:['主图','纵向解释组'],adjustable:['图在左或右','文字列宽','解释组件','各组按正文收高'],use:'一幅整体图需要保留主体或关键路径，中文解释承担论述。',avoid:'各组有独立配图却合并为无绑定的主图。'},
  {id:'labeled-rows',name:'左标签同层说明',relations:[...peer,'total-detail','conditions'],groups:[1,6],figures:[0,2],sourceTypes:['human-left-label-band'],slots:['左侧标签','右侧解释','可选侧图证区'],adjustable:['标签宽度','行距','共同正文高度'],use:'多个同层短解释可按同宽行紧凑比较。',avoid:'标签长到无法在正常字号内阅读，或把流程当无序列表。'},
  {id:'context-and-notes',name:'背景定位与分组要点',relations:['context-evidence','unordered','total-detail'],groups:[2,2],figures:[0,2],sourceTypes:['human-left-label-band','materials-badge-panel','materials-arrow-notes'],slots:['背景定位','有标题的要点组','可选侧证据'],adjustable:['背景高度','要点高度','原生符号'],use:'背景定位之后呈现政策、依据或共同风险。',avoid:'把多个独立同层栏目强塞为背景与附属说明。'},
  {id:'process-with-evidence',name:'有向过程与证据',relations:['process','causal','flow','temporal'],groups:[2,5],figures:[0,2],sourceTypes:['materials-flow-step','materials-flow-arrow','human-left-label-band','materials-paper-image'],slots:['明确顺序的步骤','可选条件或结果说明','可选配图'],adjustable:['步骤数','步骤高度','图在下方或右侧','过程区域宽度'],use:'过程或因果方向由文稿明确支持，配图补充节点与路径。',avoid:'仅因项目数相同就给并列类别加箭头。'},
  {id:'stages-with-local-figures',name:'步骤与各自图证构成完整栏目',relations:['process','flow','temporal'],groups:[2,4],figures:[2,4],sourceTypes:['materials-flow-step','materials-flow-arrow','materials-paper-image'],slots:['步骤标题','自然高度解释','每步独立图证'],adjustable:['栏目数','图证行高','等宽栏目'],use:'每一步有对应对象或设备图；将过程与其图证放在同一栏目。',avoid:'只有一张共享图却重复到多步，或为并列类别制造方向。'},
  {id:'evidence-and-details',name:'核心证据与分层补充',relations:['total-detail','evidence'],groups:[2,4],figures:[1,3],sourceTypes:['materials-filled-column','human-left-label-band','materials-paper-image'],slots:['核心论述与证据图','辅助说明组'],adjustable:['核心列宽','主辅图权重','补充组高度'],use:'一组核心证据需要完整显示，旁列补充条件、长期结果或应用。',avoid:'用更大面积替代证据强弱判断。'},
  ...relationshipCatalog,...regionCatalog
];

class LayoutError extends Error{
  constructor(code,details={}){super(code);this.code=code;this.details=details;}
}
const fail=(code,details)=>{throw new LayoutError(code,details);};
const boxOK=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]>=0&&b[1]>=0&&b[2]>0&&b[3]>0&&b[0]+b[2]<=1280.1&&b[1]+b[3]<=720.1;
const flat=v=>(Array.isArray(v)?v:[v]).map(x=>String(x??''));
const style=(box,font=17,extra={})=>({box,font,color:INK,bold:false,align:'l',vAlign:'t',leading:112,paragraphAfter:5,inset:0,labelBold:true,...extra});
const headingStyle=(box,extra={})=>style(box,20,{color:'FFFFFF',bold:true,...extra});
// One glyph of line-breaking reserve covers Chinese punctuation and mixed Latin
// words. Keep the original font; this only reserves more region before rendering.
const measure=(paras,w,font=17)=>textHeight(paras,Math.max(40,w-font*4/3),font,{leading:122})+Math.max(0,paras.length-1)*5+20;
const assetOf=(assets,id)=>Array.isArray(assets)?assets.find(a=>a.asset_id===id||a.assetId===id):assets?.[id];

/** Shared with the legacy compiler. A short caption reserves its measured height only. */
export function compileFigure({figure:f,bounds,assets={},scope='figure',captionHeight,captionReserve}={}){
  if(!f?.assetId)fail('FIGURE_ASSET_REQUIRED',{scope});
  if(!boxOK(bounds))fail('FIGURE_REGION_INVALID',{bounds});
  const policy=f.captionPolicy||(f.caption?'short':'none');
  if(!['none','short','labels-only'].includes(policy))fail('FIGURE_CAPTION_POLICY_INVALID');
  const caption=String(f.caption||'').trim();
  if(policy!=='none'&&!caption)fail('FIGURE_CAPTION_TEXT_REQUIRED',{figureId:f.id});
  const [x,y,w,h]=bounds;
  const capH=policy==='none'?0:measure([caption],w,11.5)+5;
  if(capH>72||capH>=h*.4)fail('FIGURE_CAPTION_TOO_LONG',{needed:capH,available:h,action:'将读图细节转入讲述，图注保留短定位。'});
  // captionHeight is an old caller's allowance, not an instruction to create blank space.
  let crop;try{crop=normalizeImageCrop(f.imageCrop);}catch(error){fail('IMAGE_CROP_INVALID',{message:error.message});}
  const padding=f.frame?.padding??4;
  if(!Number.isFinite(padding)||padding<2||padding>12)fail('FIGURE_FRAME_PADDING_INVALID');
  if(f.frame?.scope&&f.frame.scope!=='image')fail('FIGURE_FRAME_SCOPE_INVALID',{action:'共享图组框通过组合的figureFrame设置。'});
  const reserve=Math.max(capH,captionReserve||0);
  if(!Number.isFinite(reserve)||reserve>72||reserve>=h*.4)fail('FIGURE_CAPTION_RESERVE_INVALID');
  const imageBox=[x+padding,y+padding,w-padding*2,h-reserve-padding*2],asset=assetOf(assets,f.assetId);
  if(imageBox[2]<=0||imageBox[3]<=0)fail('FIGURE_FRAME_IMAGE_REGION_TOO_SMALL');
  if((Array.isArray(assets)&&assets.length||!Array.isArray(assets)&&Object.keys(assets).length)&&!asset)fail('FIGURE_ASSET_UNREGISTERED',{assetId:f.assetId});
  if(asset?.dimensions&&f.dimensions&&asset.dimensions.some((v,i)=>v!==f.dimensions[i]))fail('FIGURE_DIMENSIONS_MISMATCH',{assetId:f.assetId});
  const dimensions=asset?.dimensions||f.dimensions;
  if(dimensions&&(!Array.isArray(dimensions)||dimensions.length!==2||dimensions.some(v=>!Number.isFinite(v)||v<=0)))fail('FIGURE_DIMENSIONS_INVALID',{assetId:f.assetId});
  const geometry=dimensions?imageDisplayGeometry({width:dimensions[0],height:dimensions[1],bounds:imageBox,imageCrop:crop,imageAlign:f.imageAlign||'center'}):null;
  const id=f.operationId||scope+'-image';
  const operation={id,typeId:'materials-paper-image',bounds:geometry?.actualBounds||imageBox,fields:{},textOptions:{},assetId:f.assetId,imageCrop:crop,imageAlign:f.imageAlign||'center'};
  const supportFigure={...f,id:f.id||scope,operationId:id,imageCrop:crop,captionPolicy:policy,requestedBounds:bounds,...(geometry?{displayGeometry:geometry}:{})};
  const frameStyle=f.frame?.style||((f.figureType==='mechanism'&&f.figureRole!=='primary-evidence')?'dashed':'solid');
  let frame;try{frame=makeFigureFrame([supportFigure],[operation],{id:scope+'-frame',style:frameStyle,padding,reason:f.frame?.reason||(frameStyle==='dashed'?'用虚线框定位辅助机理示意，与数据及实物证据区分。':'用实线框界定独立照片、装置或论文证据的阅读范围。')});}catch(error){fail(error.message);}
  const operations=[frame,operation];
  delete supportFigure.captionOperationId;
  if(capH){
    const end=geometry?geometry.actualBounds[1]+geometry.actualBounds[3]:y+h-capH;
    const b=[frame.bounds[0],end+padding+5,frame.bounds[2],capH-5],cid=scope+'-caption';
    operations.push({id:cid,typeId:'materials-caption',bounds:b,fields:{body:caption},textOptions:{body:style(b,11.5,{color:'284461',leading:100})}});
    supportFigure.captionOperationId=cid;
  }
  return {operations,supportFigure,binding:{kind:'figure',figureId:supportFigure.id,assetId:f.assetId,operationId:id,frameOperationId:frame.id,captionOperationId:supportFigure.captionOperationId||null,requestedBounds:bounds,displayBounds:operation.bounds,imageCrop:crop}};
}

function builder(pageId,assets){
  const operations=[],contentGroups=[],bindings=[],supportFigures=[],contentRouting=[],pairedRegions=[],contentRegions=[];
  const op=(typeId,bounds,fields={},textOptions={},extra={})=>{
    const o=polishNativeOperation({id:pageId+'-c'+operations.length,typeId,bounds,fields,textOptions,...extra});operations.push(o);return o;
  };
  function route(g,o,slot='body'){
    bindings.push({kind:'group',moduleId:g.id,operationId:o.id,slot,bounds:o.textOptions?.[slot]?.box||o.bounds});
    for(const [i,t]of flat(g.paras).entries())contentRouting.push({id:pageId+'-route-'+contentRouting.length,sourceIds:g.sourceIds||[],importance:g.importance||'key',destination:'body',target:{operationId:o.id,slot},visibleText:t});
  }
  function required(g,w,treatment='tab',labelWidth=122){
    const bw=treatment==='label'?w-labelWidth-30:w-(treatment==='tab'?36:30);
    if(bw<100)fail('TEXT_COLUMN_TOO_NARROW',{moduleId:g.id,width:bw});
    const body=measure(g.paras,bw);
    const labelNeed=treatment==='label'?textHeight([g.heading],labelWidth-16,18,{leading:112,padding:4})+20:0;
    return Math.ceil(Math.max(body+(treatment==='label'?22:66),labelNeed));
  }
  function group(g,b,treatment='tab',{labelWidth=122,height,bodyY,bullet}={}){
    const [x,y,w,available]=b;
    const need=required(g,w,treatment,labelWidth),h=height??need;
    if(treatment!=='label'&&textHeight([g.heading],w-30,20,{leading:100,padding:0})>38)fail('COMPOSITION_HEADING_CAPACITY_EXCEEDED',{moduleId:g.id,heading:g.heading});
    if(need>h+.1||h>available+.1)fail('COMPOSITION_TEXT_CAPACITY_EXCEEDED',{moduleId:g.id,neededHeight:need,availableHeight:Math.min(h,available),width:w,action:'重组正文、换组合或拆页；不自动缩字。'});
    const emphasis=(g.emphasis||[]).map(e=>typeof e==='string'?{text:e,color:'C00000',bold:true}:e);
    let o;
    if(treatment==='label'){
      if(textHeight([g.heading],labelWidth-16,18,{leading:112,padding:4})+8>h-12)fail('COMPOSITION_LABEL_CAPACITY_EXCEEDED',{moduleId:g.id});
      const bb=[x+labelWidth+15,y+10,w-labelWidth-30,h-20];
      let label=g.heading;
      if(!label.includes('\n')&&/^[\u4e00-\u9fff]{4,8}$/.test(label)){
        const perLine=Math.max(1,Math.floor((labelWidth-16)/24)),rows=Math.ceil(label.length/perLine),chunk=Math.ceil(label.length/rows);
        if(rows>1)label=label.match(new RegExp('.{1,'+chunk+'}','gu')).join('\n');
      }
      o=op('human-left-label-band',[x,y,w,h],{label,body:g.paras},{label:style([x+8,y+6,labelWidth-16,h-12],18,{color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr'}),body:style(bb,17,{emphasis})},{objectBoxes:{'3':[x,y,w,h],'4':[x,y,labelWidth,h]}});
    }else if(['filled','badge','flow'].includes(treatment)){
      const bb=[x+15,y+55,w-30,h-66],tab=Math.min(w,Math.max(190,[...g.heading].length*26+30));
      const typeId={filled:'materials-filled-column',badge:'materials-badge-panel',flow:'materials-flow-step'}[treatment];
      const boxes=treatment==='filled'?{'14':[x,y,w,h],'15':[x,y,w,44]}:treatment==='badge'?{'13':[x,y+14,w,h-14],'14':[x,y,tab,44]}:{'80':[x,y,w,h],'81':[x,y,w,44]};
      o=op(typeId,[x,y,w,h],{heading:g.heading,body:g.paras},{heading:headingStyle([x+12,y+4,(treatment==='badge'?tab:w)-24,36],{align:treatment==='badge'?'l':'ctr'}),body:style(bb,17,{emphasis})},{objectBoxes:boxes});
    }else if(treatment==='tab'){
      const a=op('materials-gradient-tab',[x,y,w,41],{heading:g.heading},{heading:headingStyle([x+12,y+3,w-24,35])},{objectBoxes:{'33':[x,y,w,41]}});
      const by=bodyY??y+53,bb=[x+3,by,w-6,y+h-by];
      if(measure(g.paras,bb[2]-30)>bb[3])fail('COMPOSITION_TEXT_CAPACITY_EXCEEDED',{moduleId:g.id,neededHeight:measure(g.paras,bb[2]-30),availableHeight:bb[3]});
      const tid=bullet||g.bullet;
      if(tid&&!['human-check-notes','human-square-notes','human-dot-notes','materials-arrow-notes','materials-diamond-notes'].includes(tid))fail('COMPOSITION_BULLET_UNSUPPORTED');
      o=op(tid||'materials-text',bb,{body:g.paras},{body:style(bb,17,{emphasis,...(tid?{bullet:'source'}:{})})});
      contentGroups.push({id:a.id+'-group',task:'module-heading',relation:g.relation||'parallel',anchorId:a.id,memberIds:[o.id],moduleIds:[g.id],bounds:[x,y,w,h]});
    }else fail('COMPOSITION_TREATMENT_UNSUPPORTED',{treatment});
    route(g,o);return {operation:o,height:h,group:contentGroups.at(-1)};
  }
  function figure(f,b,captionReserve){
    const c=compileFigure({figure:f,bounds:b,captionReserve,assets,scope:pageId+'-f'+supportFigures.length});operations.push(...c.operations);supportFigures.push(c.supportFigure);bindings.push(c.binding);return c;
  }
  return {operations,contentGroups,bindings,supportFigures,contentRouting,pairedRegions,contentRegions,op,group,figure,required,route};
}

function validate(spec){
  const {compositionId,groups=[],figures=[],bounds,relation,options={}}=spec;
  const c=compositionCatalog.find(c=>c.id===compositionId);if(!c)fail('COMPOSITION_UNKNOWN',{compositionId});
  if(!Array.isArray(groups)||!Array.isArray(figures))fail('COMPOSITION_GROUPS_AND_FIGURES_MUST_BE_ARRAYS');
  if(!boxOK(bounds))fail('COMPOSITION_BOUNDS_INVALID',{bounds});
  if(!c.relations.includes(relation))fail('COMPOSITION_RELATION_MISMATCH',{compositionId,relation,allowed:c.relations});
  if(groups.length<c.groups[0]||groups.length>c.groups[1]||figures.length<c.figures[0]||figures.length>c.figures[1])fail('COMPOSITION_SLOT_COUNT_MISMATCH',{compositionId,groupCount:groups.length,figureCount:figures.length,supported:{groups:c.groups,figures:c.figures}});
  const ids=new Set();
  for(const g of groups){
    if(!g?.id||ids.has(g.id)||typeof g.heading!=='string'||!g.heading.trim()||!Array.isArray(g.paras)||!g.paras.length||g.paras.some(t=>typeof t!=='string'||!t.trim()))fail('COMPOSITION_GROUP_INVALID',{moduleId:g?.id});ids.add(g.id);
    if(g.emphasis?.some(e=>!g.paras.some(t=>t.includes(typeof e==='string'?e:e.text))))fail('COMPOSITION_EMPHASIS_NOT_VISIBLE',{moduleId:g.id});
  }
  if(peer.includes(relation)&&!isRegionComposition(compositionId)&&(new Set(groups.map(g=>g.level??1)).size>1||new Set(groups.map(g=>g.parentId??null)).size>1))fail('COMPOSITION_PEER_LEVEL_MISMATCH');
  for(const f of figures){
    if(!f.id||!f.assetId||!Array.isArray(f.claimModuleIds)||!f.claimModuleIds.length||f.claimModuleIds.some(id=>!ids.has(id)))fail('COMPOSITION_FIGURE_CLAIM_INVALID',{figureId:f.id});
    if(!['data','phenomenon','mechanism','scene','object','mixed'].includes(f.figureType)||!['primary-evidence','supporting-explanation','context'].includes(f.figureRole)||!f.readingTargets?.length)fail('COMPOSITION_FIGURE_PURPOSE_REQUIRED',{figureId:f.id});
    let crop;try{crop=normalizeImageCrop(f.imageCrop);}catch(error){fail('IMAGE_CROP_INVALID',{message:error.message});}
    for(const t of f.readingTargets){const r=t.rect;if(!t.name||!['read','recognize'].includes(t.task)||!Array.isArray(r)||r.length!==4||r.some(v=>!Number.isFinite(v))||r[2]<=0||r[3]<=0||r[0]<crop[0]-1e-5||r[1]<crop[1]-1e-5||r[0]+r[2]>1-crop[2]+1e-5||r[1]+r[3]>1-crop[3]+1e-5)fail('COMPOSITION_READING_TARGET_CROPPED',{figureId:f.id,target:t.name});}
  }
  if(new Set(figures.map(f=>f.id)).size!==figures.length)fail('COMPOSITION_DUPLICATE_FIGURE_ID');
  if(options.gap!==undefined&&(!Number.isFinite(options.gap)||options.gap<12||options.gap>48))fail('COMPOSITION_GAP_INVALID');
  if(options.verticalPlacement!==undefined&&!['auto','center','distribute','top'].includes(options.verticalPlacement))fail('SPATIAL_PLACEMENT_INVALID');
  return c;
}

/** Compile only reviewed recipe regions; this is not a general layout solver. */
export function compileComposition({compositionId,bounds=[44,177,1192,480],groups=[],figures=[],relation,options={},assets={},pageId='page',regions,edges}={}){
  try{
    const spec={compositionId,bounds,groups,figures,relation,options};const recipe=validate(spec);
    if(regions?.length&&!isRegionComposition(compositionId))fail('REGIONS_REQUIRE_REGIONAL_COMPOSITION');
    if(isRegionComposition(compositionId))return compileRegions({compositionId,bounds,groups,figures,relation,options,assets,pageId,regions,edges},compileFigure);
    const b=builder(pageId,assets),[x,y,w,h]=bounds,gap=options.gap??28;
    const columns=(items,region,treatment='tab')=>{
      const [cx,cy,cw,ch]=region,col=(cw-gap*(items.length-1))/items.length;
      const height=Math.max(...items.map(g=>b.required(g,col,treatment)));
      items.forEach((g,i)=>b.group(g,[cx+i*(col+gap),cy,col,ch],treatment,{height}));return height;
    };
    const figureRow=(items,region)=>{
      const weights=options.figureWeights||items.map(f=>{const d=f.dimensions||assetOf(assets,f.assetId)?.dimensions||[1,1];const c=normalizeImageCrop(f.imageCrop);return Math.min(2.7,Math.max(.6,d[0]*(1-c[0]-c[2])/d[1]/(1-c[1]-c[3])));});
      if(weights.length!==items.length||weights.some(v=>!Number.isFinite(v)||v<=0))fail('COMPOSITION_FIGURE_WEIGHTS_INVALID');
      const [fx,fy,fw,fh]=region,space=fw-gap*(items.length-1),sum=weights.reduce((a,v)=>a+v,0);let cursor=fx;
      const sharedCaption=options.figureFrame?.scope==='group'?Math.max(...items.map((f,i)=>(f.captionPolicy|| (f.caption?'short':'none'))==='none'?0:measure([f.caption],space*weights[i]/sum,11.5)+5)):undefined;
      items.forEach((f,i)=>{const width=space*weights[i]/sum;b.figure(f,[cursor,fy,width,fh],sharedCaption);cursor+=width+gap;});
    };
    if(relationshipCatalog.some(c=>c.id===compositionId))compileRelationship({b,compositionId,bounds,groups,figures,options,fail});
    else if(compositionId==='peer-text-panels'){
      const hh=columns(groups,bounds,options.treatment||'tab');
      if(figures.length){if(h-hh-24<150)fail('COMPOSITION_FIGURE_REGION_TOO_SMALL');figureRow(figures,[x,y+hh+24,w,h-hh-24]);}
    }
    else if(compositionId==='labeled-rows'){
      const labelWidth=options.labelWidth??170;
      const rw=figures.length?(options.textWidth??740):w;
      if(figures.length&&rw-labelWidth-30<340)fail('FIGURE_LABEL_BODY_TOO_NARROW');
      const height=Math.max(...groups.map(g=>b.required(g,rw,'label',labelWidth))),rowGap=spatialGap(groups.map(()=>height),h,gap,options.verticalPlacement||'auto'),space=height*groups.length+rowGap*(groups.length-1);
      if(space>h)fail('COMPOSITION_ROW_CAPACITY_EXCEEDED',{neededHeight:space,availableHeight:h});
      groups.forEach((g,i)=>b.group(g,[x,y+(h-space)/2+i*(height+rowGap),rw,height],'label',{height,labelWidth}));
      if(figures.length)figures.forEach((f,i)=>b.figure(f,[x+rw+gap,y+i*(h+gap)/figures.length,w-rw-gap,(h-gap*(figures.length-1))/figures.length]));
    }else if(compositionId==='peer-figure-columns'){
      if(figures.length!==groups.length)fail('COMPOSITION_ONE_FIGURE_PER_GROUP_REQUIRED');
      if(!['heading-image-body','heading-body-image'].includes(options.order||'heading-image-body'))fail('COMPOSITION_ORDER_UNSUPPORTED');
      const col=(w-gap*(groups.length-1))/groups.length,bodyH=Math.max(...groups.map(g=>measure(g.paras,col-36)));
      const imageH=h-41-12-bodyH-18;
      if(imageH<130)fail('COMPOSITION_FIGURE_REGION_TOO_SMALL',{availableHeight:imageH,action:'减少重复说明或改用共享图结构。'});
      groups.forEach((g,i)=>{
        const owned=figures.filter(f=>f.claimModuleIds.length===1&&f.claimModuleIds[0]===g.id);if(owned.length!==1)fail('COMPOSITION_PEER_FIGURE_BINDING_MISMATCH',{moduleId:g.id});
        const xx=x+i*(col+gap),imageFirst=(options.order||'heading-image-body')==='heading-image-body';
        const bodyY=imageFirst?y+41+12+imageH+18:y+53;
        const a=b.group(g,[xx,y,col,h],'tab',{height:h,bodyY});
        const imgY=imageFirst?y+53:bodyY+bodyH+18;
        const f=b.figure(owned[0],[xx+3,imgY,col-6,imageH]);
        if(imageFirst){
          const imageOperation=f.operations.find(o=>o.id===f.supportFigure.operationId),actual=imageOperation.bounds;
          // A naturally short image cannot bridge a huge blank band. Move its body up.
          const caption=f.operations.find(o=>o.id===f.supportFigure.captionOperationId);
          const targetY=Math.max(actual[1]+actual[3]+f.supportFigure.framePadding+14,caption?caption.bounds[1]+caption.bounds[3]+14:0),bb=a.operation.bounds;
          a.operation.bounds=[bb[0],targetY,bb[2],bodyH];a.operation.textOptions.body.box=a.operation.bounds;
          a.group.imageMemberIds=[imageOperation.id];
          const titleEnd=y+41;if(actual[1]-titleEnd>40)fail('COMPOSITION_FIGURE_BRIDGE_GAP',{figureId:owned[0].id,action:'使用顶部对齐或调整图片行高。'});
        }else{a.operation.bounds[3]=bodyH;a.operation.textOptions.body.box=a.operation.bounds;}
        b.bindings.find(v=>v.kind==='group'&&v.moduleId===g.id).bounds=a.operation.bounds;
      });
    }else if(compositionId==='stages-with-local-figures'){
      if(figures.length!==groups.length||groups.some(g=>g.role!=='step'))fail('STAGE_FIGURE_BINDING_REQUIRED');
      const col=(w-gap*(groups.length-1))/groups.length,bodyH=Math.max(...groups.map(g=>measure(g.paras,col-30))),imageH=Math.min(options.figureHeight??240,h-66-bodyH-18);
      if(imageH<150)fail('STAGE_COLUMN_CAPACITY_EXCEEDED',{availableImageHeight:imageH});
      const total=66+bodyH+18+imageH;
      groups.forEach((g,i)=>{
        const owned=figures.filter(f=>f.claimModuleIds.length===1&&f.claimModuleIds[0]===g.id);if(owned.length!==1)fail('STAGE_FIGURE_BINDING_REQUIRED',{moduleId:g.id});
        const xx=x+i*(col+gap),a=b.group(g,[xx,y,col,h],'flow',{height:total});
        a.operation.textOptions.body.box[3]=bodyH;
        const f=b.figure(owned[0],[xx+8,y+55+bodyH+18,col-16,imageH]);
        b.contentRegions.push({id:g.id,kind:'integrated-column',moduleIds:[g.id],operationIds:[a.operation.id,...f.operations.map(o=>o.id)],bounds:[xx,y,col,total]});
        if(i<groups.length-1)b.op('materials-flow-arrow',[xx+col+4,y+total/2-15,gap-8,30]);
      });
    }else if(compositionId==='text-over-figures'){
      const textH=columns(groups,bounds,options.treatment||'filled'),fy=y+textH+20,available=h-textH-20;
      if(available<140)fail('COMPOSITION_FIGURE_REGION_TOO_SMALL',{availableHeight:available});figureRow(figures,[x,fy,w,available]);
    }else if(compositionId==='figure-with-explanations'){
      const d=figures[0].dimensions||assetOf(assets,figures[0].assetId)?.dimensions||[1,1];
      const textWidth=options.textWidth??(d[0]/d[1]>1.4?450:590);
      if(!Number.isFinite(textWidth)||textWidth<340||textWidth>w-300-gap)fail('COMPOSITION_TEXT_WIDTH_INVALID',{textWidth});
      const treatment=options.treatment||'tab',labelWidth=options.labelWidth??122;
      if(treatment==='label'&&textWidth-labelWidth-30<340)fail('FIGURE_LABEL_BODY_TOO_NARROW',{width:textWidth-labelWidth-30,minimum:340,action:'主图旁窄文字栏改用圆角横向标题，或扩大解释栏；不缩字。'});
      const heights=groups.map(g=>b.required(g,textWidth,treatment,labelWidth));
      const total=heights.reduce((a,v)=>a+v,0)+gap*(groups.length-1);
      if(total>h)fail('COMPOSITION_STACK_CAPACITY_EXCEEDED',{neededHeight:total,availableHeight:h});
      const side=options.figurePosition||'left';if(!['left','right'].includes(side))fail('COMPOSITION_FIGURE_POSITION_INVALID');
      const textX=side==='left'?x+w-textWidth:x,imageX=side==='left'?x:x+textWidth+gap;
      let yy=y;groups.forEach((g,i)=>{b.group(g,[textX,yy,textWidth,heights[i]],treatment,{height:heights[i],labelWidth});yy+=heights[i]+gap;});
      b.figure(figures[0],[imageX,y,w-textWidth-gap,h]);
      b.pairedRegions.push({id:pageId+'-figure-explanations',frameOperationId:b.supportFigures[0].frameOperationId,figureId:b.supportFigures[0].id,groups:b.contentGroups.map(g=>({operationIds:[g.anchorId,...g.memberIds],start:{operationId:g.anchorId},end:{operationId:g.memberIds.at(-1),slot:'body'}}))});
    }else if(compositionId==='context-and-notes'){
      const rw=figures.length?(options.textWidth??740):w,topH=b.required(groups[0],rw,'label',options.labelWidth??150);
      b.group(groups[0],[x,y,rw,h],'label',{height:topH,labelWidth:options.labelWidth??150});
      b.group(groups[1],[x,y+topH+gap,rw,h-topH-gap],'tab',{bullet:options.bullet||'materials-arrow-notes'});
      if(figures.length)figures.forEach((f,i)=>b.figure(f,[x+rw+gap,y+i*(h+gap)/figures.length,w-rw-gap,(h-gap*(figures.length-1))/figures.length]));
    }else if(compositionId==='process-with-evidence'){
      const steps=groups.filter(g=>g.role==='step'),extra=groups.filter(g=>['condition','annotation'].includes(g.role));
      if(steps.length<2||steps.length>4||extra.length>1||steps.length+extra.length!==groups.length)fail('COMPOSITION_EXPLICIT_STEPS_REQUIRED');
      const side=options.figurePosition==='right';
      if(side&&figures.length!==1)fail('COMPOSITION_SIDE_PROCESS_NEEDS_ONE_FIGURE');
      const pw=side?(options.processWidth??690):w;
      if(pw<500||pw>w||(side&&w-pw-gap<300))fail('COMPOSITION_PROCESS_WIDTH_INVALID');
      const sgap=32,col=(pw-sgap*(steps.length-1))/steps.length,stepH=Math.max(...steps.map(g=>b.required(g,col,'flow')));
      steps.forEach((g,i)=>{b.group(g,[x+i*(col+sgap),y,col,h],'flow',{height:stepH});if(i<steps.length-1)b.op('materials-flow-arrow',[x+(i+1)*col+i*sgap+4,y+stepH/2-15,sgap-8,30]);});
      const separation=!figures.length&&extra.length?spatialGap([stepH,b.required(extra[0],pw,'badge')],h,24,options.verticalPlacement||'auto'):24;
      const yy=y+stepH+separation,available=h-stepH-separation;
      if(side){
        if(extra.length)b.group(extra[0],[x,yy,pw,available],'label',{labelWidth:options.labelWidth??122});
        b.figure(figures[0],[x+pw+gap,y,w-pw-gap,h]);
      }else{
      if(figures.length&&available<150)fail('COMPOSITION_FIGURE_REGION_TOO_SMALL',{availableHeight:available});
      let fx=x,fw=w;
      if(extra.length){const ew=figures.length?(options.annotationWidth??360):w;b.group(extra[0],[x,yy,ew,available],'badge');fx=x+ew+gap;fw=w-ew-gap;}
      if(figures.length)figureRow(figures,[fx,yy,fw,available]);
      }
    }else if(compositionId==='evidence-and-details'){
      const core=groups.filter(g=>g.role==='core'),details=groups.filter(g=>g.role==='detail');
      if(core.length!==1||details.length!==groups.length-1)fail('COMPOSITION_CORE_DETAIL_ROLES_REQUIRED');
      if(figures.some(f=>!f.claimModuleIds.includes(core[0].id)))fail('COMPOSITION_CORE_FIGURE_BINDING_MISMATCH');
      const cw=options.coreWidth??(w-gap)*.5,dw=w-cw-gap;
      if(cw<340||dw<340)fail('COMPOSITION_CORE_WIDTH_INVALID');
      const topH=b.required(core[0],cw,'filled');b.group(core[0],[x,y,cw,h],'filled',{height:topH});
      const fy=y+topH+18,fh=h-topH-18;if(fh<140)fail('COMPOSITION_FIGURE_REGION_TOO_SMALL',{availableHeight:fh});figureRow(figures,[x,fy,cw,fh]);
      let yy=y;for(const g of details){const hh=b.required(g,dw,'label',options.labelWidth??120);b.group(g,[x+cw+gap,yy,dw,y+h-yy],'label',{height:hh,labelWidth:options.labelWidth??120});yy+=hh+gap;}
    }
    if(options.figureFrame){
      if(compositionId!=='text-over-figures')fail('FIGURE_FRAME_GROUP_COMPOSITION_UNSUPPORTED');
      try{combineFigureFrames(b,options.figureFrame);}catch(error){fail(error.message);}
    }
    balanceComposition(b,{compositionId,bounds,options});
    if(b.pairedRegions.some(p=>p.fit==='text-taller-than-figure'))fail('PAIRED_CONTENT_NEEDS_ALTERNATIVE_LAYOUT',{action:'相关解释的自然高度超过主图；扩大图的合理阅读区或改为上下/栏目组合，不强制拉开。'});
    for(const o of b.operations){
      if(!boxOK(o.bounds))fail('COMPOSITION_OBJECT_OUTSIDE_SLIDE',{operationId:o.id,bounds:o.bounds});
      const z=o.bounds;if(z[0]<x-.1||z[1]<y-.1||z[0]+z[2]>x+w+.1||z[1]+z[3]>y+h+.1)fail('COMPOSITION_OBJECT_OUTSIDE_REGION',{operationId:o.id,bounds:z,region:bounds});
    }
    const visual=auditVisualPlan({pages:[{id:pageId,role:'content',compositionId,modules:groups,supportFigures:b.supportFigures,operations:b.operations,contentGroups:b.contentGroups,compositionBounds:bounds,spatialLanes:b.spatialLanes,pairedRegions:b.pairedRegions,contentRegions:b.contentRegions}]});
    if(groups.every(g=>g.visualIntent)&&!visual.pass)fail(visual.issues[0].code,{issues:visual.issues});
    const frames=auditFigureFrames({pages:[{id:pageId,role:'content',supportFigures:b.supportFigures,operations:b.operations}]});
    if(!frames.pass)fail(frames.issues[0].code,{issues:frames.issues});
    const spatialReview=auditSpatialLayout({pages:[{id:pageId,role:'content',compositionBounds:bounds,operations:b.operations,contentGroups:b.contentGroups,supportFigures:b.supportFigures,spatialLanes:b.spatialLanes,pairedRegions:b.pairedRegions}]});
    return {ok:true,compositionId,operations:b.operations,contentGroups:b.contentGroups,supportFigures:b.supportFigures,contentRouting:b.contentRouting,bindings:b.bindings,pairedRegions:b.pairedRegions,contentRegions:b.contentRegions,usedBounds:bounds,availableBounds:bounds,occupiedBounds:b.spatialLayout.occupiedBounds,spatialLayout:b.spatialLayout,spatialLanes:b.spatialLanes,spatialReview,visualReview:visual,recipe:{id:recipe.id,sourceTypes:recipe.sourceTypes},errors:[]};
  }catch(error){if(!(error instanceof LayoutError))throw error;return {ok:false,compositionId,operations:[],errors:[{code:error.code,...error.details}],suggestions:['重组正文与图组','换用匹配的组合','确实超容量时拆页']};}
}

/** Content relations and image duties precede component style. No topic matching. */
export function recommendCompositions(pageSpec={}){
  const groups=pageSpec.groups||pageSpec.modules||[],figures=pageSpec.figures||pageSpec.supportFigures||[],relation=pageSpec.relation;
  if(!relation)return {ok:false,candidates:[],errors:[{code:'COMPOSITION_RELATION_REQUIRED'}]};
  const candidates=[],incompatible=[];
  for(const recipe of compositionCatalog){
    if(!recipe.relations.includes(relation)||groups.length<recipe.groups[0]||groups.length>recipe.groups[1]||figures.length<recipe.figures[0]||figures.length>recipe.figures[1])continue;
    const options=pageSpec.compositionOptions||pageSpec.options||{};
    const fit=compileComposition({compositionId:recipe.id,pageId:pageSpec.id||'recommend',bounds:pageSpec.bounds,groups,figures,relation,options,assets:pageSpec.assets,regions:pageSpec.regions,edges:pageSpec.edges});
    if(!fit.ok){incompatible.push({compositionId:recipe.id,errors:fit.errors});continue;}
    if(!fit.spatialReview.pass){incompatible.push({compositionId:recipe.id,errors:fit.spatialReview.issues});continue;}
    let score=10;
    const task=pageSpec.task||pageSpec.pageTask;
    if(recipe.task===task)score+=34;
    if(pageSpec.regions?.length&&isRegionComposition(recipe.id))score+=20;
    const relationTarget={'temporal':'timeline-with-evidence','classification':'classified-with-evidence','unordered':'numbered-with-evidence','merge':'merge-with-evidence','collaboration':'merge-with-evidence','total-detail':'branch-with-evidence','cycle':'cycle-with-evidence','comparison':'matrix-with-evidence','matrix':'matrix-with-evidence','problem-response':'response-with-evidence','conditions':'labeled-rows'}[relation];
    if(recipe.id===relationTarget)score+=24;
    if(task==='data-interpretation'&&recipe.id==='figure-with-explanations')score+=18;
    if(task==='main-figure-reading'&&recipe.id==='figure-with-explanations')score+=18;
    if(task==='scene-gallery'&&recipe.id==='text-over-figures')score+=12;
    if(task==='paired-evidence'&&recipe.id==='peer-figure-columns')score+=10;
    const prior=pageSpec.usedStructures||[];score-=Math.min(8,prior.filter(v=>v===recipe.id).length*2);
    if(recipe.id==='peer-figure-columns'&&figures.length===groups.length&&figures.every(f=>f.claimModuleIds?.length===1))score+=12;
    if(recipe.id==='process-with-evidence'&&groups.some(g=>g.role==='step'))score+=15;
    if(recipe.id==='evidence-and-details'&&groups.some(g=>g.role==='core'))score+=15;
    if(recipe.id==='figure-with-explanations'&&figures.length===1&&figures[0].claimModuleIds?.length>1)score+=8;
    if(recipe.id==='labeled-rows'&&groups.length>=3){const lengths=groups.map(g=>g.paras.join('').length);if(Math.max(...lengths)/Math.max(1,Math.min(...lengths))>1.6)score+=9;}
    if(recipe.id==='text-over-figures'&&figures.some(f=>{const d=f.dimensions||assetOf(pageSpec.assets,f.assetId)?.dimensions;return d&&d[0]/d[1]>1.6;}))score+=10;
    const spatial=fit.spatialLayout;if(spatial&&Math.abs(spatial.centerOffsetRatio||0)<.1)score+=3;
    const references=recipe.sourceTypes.flatMap(type=>findCases({typeId:type}).map(c=>({typeId:c.typeId,sourceFile:c.sourceFile,sourcePage:c.sourcePage,sourceObjectIds:c.sourceObjectIds,slots:c.slots,capacity:c.capacity||c.capacityPolicy})));
    candidates.push({compositionId:recipe.id,name:recipe.name,score,spatial,structure:structureSignature(fit),references,referenceTypes:recipe.sourceTypes,reason:{task:task||null,relation,sameLevelCount:groups.length,imageRoles:figures.map(f=>f.figureRole),fit:'正文容量、图片区域及内容整体位置已通过组合预检'},constraints:{groups:recipe.groups,figures:recipe.figures,slots:recipe.slots,adjustable:recipe.adjustable},use:recipe.use,avoid:recipe.avoid});
  }
  candidates.sort((a,b)=>b.score-a.score);candidates.forEach((c,i)=>c.rank=i+1);
  const seen=new Set(),distinctCandidates=candidates.filter(c=>{const key=c.structure.fingerprint;if(seen.has(key))return false;seen.add(key);return true;});
  return {ok:!!candidates.length,candidates,distinctCandidates,incompatible,errors:candidates.length?[]:[{code:'NO_COMPOSITION_FITS',action:'检查关系、绑定、容量与图片形状，再重组或拆页。'}]};
}

/** Recommendations are executable choices; a reviewed override needs a page-specific reason. */
export function chooseComposition(request={}){
  const result=recommendCompositions(request);if(!result.ok)return {...result,selected:null};
  const choice=request.selection||{mode:'auto'};
  if(choice.mode==='reviewed'){
    if(typeof choice.reason!=='string'||choice.reason.trim().length<18)return {...result,ok:false,selected:null,errors:[{code:'SPECIFIC_SELECTION_REASON_REQUIRED'}]};
    if(!result.candidates.some(c=>c.compositionId===choice.compositionId))return {...result,ok:false,selected:null,errors:[{code:'REVIEWED_SELECTION_NOT_CERTIFIED'}]};
    return {...result,selected:choice.compositionId,selectionMode:'reviewed',selectionReason:choice.reason};
  }
  const selected=result.candidates[0];
  return {...result,selected:selected.compositionId,selectionMode:'auto',selectionReason:`${request.relation}关系，${(request.groups||[]).length}个模块、${(request.figures||[]).length}幅图；${selected.use} 正常字号与实际图证区域预检通过。`};
}
