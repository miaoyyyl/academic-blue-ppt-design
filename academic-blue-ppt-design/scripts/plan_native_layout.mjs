/** Compile a reviewed logical page plan into calls to original materials objects.
 * Every primitive below names a bank prototype. This file contains no drawing API.
 * Geometry is placement of a copied object; there is no invented fallback shape.
 */
import fs from 'node:fs';
import path from 'node:path';
import {applyNarrativePolicy,contentPanelHeight,textHeight} from '../assets/narrative-layout.mjs';
import {recommendComponents,auditComposition} from '../assets/component-selection.mjs';
import {createNavigationOperation} from '../assets/navigation-layout.mjs';
import {compileComposition,compileFigure,chooseComposition} from '../assets/composition-layout.mjs';
import {applySpatialPlan} from '../assets/spatial-layout.mjs';
import {createPageLead,contentBoundsFor,claimSlot} from '../assets/page-lead.mjs';
import {polishNativeOperation} from '../assets/component-polish.mjs';
const [input,output]=process.argv.slice(2);
if(!output)throw Error('Usage: plan_native_layout.mjs compact-plan.json native-plan.json');
const plan=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''));
const compositionSelections=[];
const usedStructures=[];
let legacyFigureSerial=0;
const font=17,ink='162B40',blue='004BAD';
const copy=(typeId,bounds,fields={},textOptions={},extra={})=>polishNativeOperation({typeId,bounds,fields,textOptions,...extra});
function text(value,box,size=font,{color=ink,bold=false,align='l',leading=100}={}){
  return copy('materials-text',box,{body:value},{body:{box,font:size,color,bold,align,leading,labelBold:true}});
}
function panel(heading,paras,b,kind='column',size=font){
  if(!heading?.trim())throw Error('PANEL_CONTENT_HEADING_REQUIRED');
  const choice=recommendComponents({task:kind==='badge'?'method-groups':'parallel-explanations',structure:'groups',relation:'parallel'});
  const selected=choice.cases.find(c=>c.typeId===(kind==='badge'?'materials-badge-panel':'materials-filled-column'));
  if(!selected)throw Error('SOURCE_PANEL_SELECTION_FAILED');
  const selection={componentTask:kind==='badge'?'method-groups':'parallel-explanations',selectionReason:selected.selectionReason};
  const [x,y,w,available]=b;
  // PowerPoint's real Chinese line box is taller than the nominal font size.
  const h=paras.length?contentPanelHeight(paras,w,size,{maxHeight:available,leading:120}):available;
  b=[x,y,w,h];
  if(kind==='badge'){
    const tab=Math.min(w-12,Math.max(160,heading.length*27+28));
    return copy('materials-badge-panel',b,{heading,body:paras},{heading:{font:20,color:'FFFFFF',bold:true,box:[x+12,y+4,tab-24,36]},body:{font:size,color:ink,bold:false,labelBold:true,box:[x+14,y+54,w-28,h-66]}},{objectBoxes:{'13':[x,y+14,w,h-14],'14':[x,y,tab,42]},...selection});
  }
  return copy('materials-filled-column',b,{heading,body:paras},{heading:{font:20,color:'FFFFFF',bold:true,align:'l',box:[x+13,y+4,w-26,38]},body:{font:size,color:ink,bold:false,labelBold:true,box:[x+13,y+55,w-26,h-67]}},{objectBoxes:{'14':b,'15':[x,y,w,46]},...selection});
}
function titledGroup(module,box,id,{asNotes=false}={}){
  if(!module.heading?.trim())throw Error('TITLED_EXPLANATION_HEADING_REQUIRED');
  const [x,y,w,h]=box,headingChoice=recommendComponents({task:'module-heading',structure:'heading'}).cases[0];
  const headingWidth=Math.min(w,Math.max(220,module.heading.length*28+44));
  const header=copy(headingChoice.typeId,[x,y,headingWidth,44],{heading:module.heading},{heading:{font:21,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr',box:[x+18,y+4,headingWidth-36,36]}},{id:id+'-heading',componentTask:'module-heading',selectionReason:headingChoice.selectionReason});
  const bodyBox=[x+6,y+64,w-12,h-64];
  if(textHeight(module.paras,bodyBox[2],17,{leading:108})>bodyBox[3])throw Error('TITLED_EXPLANATION_CAPACITY_EXCEEDED');
  const body=asNotes?notes(module,bodyBox):text(module.paras,bodyBox,17,{leading:108});
  body.id=id+'-body';body.componentTask=module.componentTask||'parallel-explanations';
  return {operations:[header,body],group:{id,task:body.componentTask,relation:module.relation||'parallel',bounds:box,anchorId:header.id,memberIds:[body.id]}};
}
function statement(value,b=[40,98,1200,62],size=22){return copy('human-gradient-statement',b,{body:value},{body:{font:size,color:blue,bold:true,align:'ctr',box:[b[0]+12,b[1]+7,b[2]-24,b[3]-11],leading:101}},{objectBoxes:{'49':b},componentTask:'key-claim'});}
function notes(module,box,size=17){
 const task=module.componentTask;
 if(!task)throw Error('NOTES_CONTENT_TASK_REQUIRED');
 const result=recommendComponents({task,relation:module.relation||'unordered',itemCount:module.paras.length,evidenceStatus:module.evidenceStatus});
 if(!result.ok)throw Error('CONTENT_COMPONENT_SELECTION: '+JSON.stringify(result.errors));
 const typeId=result.cases[0].typeId;
 if(!['human-square-notes','human-check-notes','human-dot-notes','materials-arrow-notes','materials-diamond-notes'].includes(typeId))throw Error('NOTES_TASK_REQUIRES_DIFFERENT_SOURCE_STRUCTURE');
 if(textHeight(module.paras,box[2]-36,size,{leading:108})+module.paras.length*8>box[3])throw Error('NATIVE_LIST_CAPACITY_EXCEEDED');
 return copy(typeId,box,{body:module.paras},{body:{box,font:size,color:ink,bold:false,labelBold:true,align:'l',leading:108,paragraphAfter:8,bullet:'source'}},{componentTask:task,selectionReason:result.cases[0].selectionReason});
}
function leftContext(module,box){
 const [x,y,w,h]=box;
 if(textHeight(module.paras,w-190,17,{leading:108})>h-24)throw Error('LEFT_CONTEXT_CAPACITY_EXCEEDED');
 return copy('human-left-label-band',box,{label:module.heading,body:module.paras},{label:{font:21,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr',box:[x+10,y+12,130,h-24]},body:{font:17,color:ink,bold:false,labelBold:true,align:'l',leading:108,box:[x+170,y+12,w-195,h-24]}},{objectBoxes:{'3':box,'4':[x,y,150,h]},componentTask:module.componentTask||'background'});
}
function figure(f,b,captionH=34){
  const c=compileFigure({figure:f,bounds:b,captionHeight:captionH,assets:plan.assets||{},scope:f?.id||'legacy-figure-'+legacyFigureSerial++});
  Object.assign(f,c.supportFigure);return c.operations;
}
function frame(s){return copy('materials-frame',[0,0,1280,77],{title:s.title,number:s.sectionLabel||''},{title:{font:30,color:'FFFFFF',bold:true,box:[124,10,1100,57]},number:{font:23,color:blue,bold:true,align:'ctr',box:[45,13,73,50]}});}
const pages=[];
for(const s of plan.pages){
  const modes=[s.compositionId,s.layoutTemplate,Array.isArray(s.operations)&&s.operations.length>0].filter(Boolean);
  if(modes.length>1)throw Error('PAGE_LAYOUT_INPUT_CONFLICT: '+s.id+'; use compositionId, layoutTemplate, or operations.');
  if(Array.isArray(s.operations)&&s.operations.length>0){pages.push(structuredClone(s));continue;}
  const ops=[],groups=[...(s.contentGroups||[])],m=s.modules||[],f=s.supportFigures||[];
  const addTitled=(module,box,id,opts)=>{const g=titledGroup(module,box,s.id+'-'+id,opts);ops.push(...g.operations);groups.push(g.group);};
  const paras=(i)=>m[i]?.paras||[];
  if(['cover','closing'].includes(s.role)){
    ops.push(copy('materials-cover',[0,0,1280,720],{title:s.displayTitle||s.title,subtitle:s.subtitle||'',meta:s.meta||''}, {title:{font:s.role==='cover'?42:48,color:blue,bold:true,align:'ctr',box:[75,185,1130,235]},subtitle:{font:19,color:blue,bold:true,align:'ctr'},meta:{font:15,color:'FFFFFF',align:'ctr'}},{objectBoxes:{'8':[0,0,1280,720],'60':[344.581,-344.581,590.838,1280]}}));
  }else if(s.role==='toc'){
    const active=plan.chapters.findIndex(c=>c.id===s.chapterId);
    ops.push(createNavigationOperation({items:plan.chapters.map(c=>c.title),activeIndex:Math.max(0,active)}));
  }else if(s.role==='reference'){
    ops.push(frame(s));
    const refs=s.referenceText.map(x=>typeof x==='string'?x:x.text);
    const split=Math.ceil(refs.length/2);
    ops.push(text(refs.slice(0,split),[44,110,579,550],14.5,{leading:106}));
    ops.push(text(refs.slice(split),[659,110,577,550],14.5,{leading:106}));
  }else{
    ops.push(frame(s));
    s.lead||={mode:'none',reason:'默认由页头承载判断；额外引领需在规划中明确其共同作用。'};
    const leadOp=createPageLead(s);if(leadOp)ops.push(leadOp);
    s.compositionBounds=contentBoundsFor(s);
    s.visibleArgument=leadOp?leadOp.fields[claimSlot(leadOp)]:s.title;
    if(s.compositionId){
      if(!s.relation)throw Error('EXPLICIT_CONTENT_RELATION_REQUIRED: '+s.id);
      const request={id:s.id,task:s.pageTask||s.task,relation:s.relation,groups:m,figures:f,bounds:s.compositionBounds,compositionOptions:s.compositionOptions,assets:plan.assets||{},usedStructures,regions:s.regions,edges:s.edges,selection:s.compositionSelection||(s.compositionId==='auto'?{mode:'auto'}:{mode:'reviewed',compositionId:s.compositionId,reason:s.compositionRationale})};
      const selection=chooseComposition(request);
      if(!selection.ok)throw Error('COMPOSITION_SELECTION_FAILED: '+JSON.stringify({pageId:s.id,...selection}));
      s.compositionId=selection.selected;usedStructures.push(selection.selected);
      const c=compileComposition({compositionId:selection.selected,pageId:s.id,bounds:s.compositionBounds,groups:m,figures:f,relation:s.relation,options:s.compositionOptions,assets:plan.assets||{},regions:s.regions,edges:s.edges});
      s.compositionRationale=selection.selectionReason+(s.selectionContext?' 本页：'+s.selectionContext:'');
      compositionSelections.push({pageId:s.id,...selection,authorReason:s.compositionRationale,bindings:c.bindings||[]});
      if(!c.ok)throw Error('COMPOSITION_NOT_FIT: '+JSON.stringify({pageId:s.id,...c}));
      ops.push(...c.operations);groups.push(...c.contentGroups);s.supportFigures=c.supportFigures;
      const argumentOp=leadOp||ops[0];if(!argumentOp.id)argumentOp.id=s.id+'-header';
      s.contentRouting=[...(s.contentRouting||[]),{id:s.id+'-argument',importance:'key',sourceIds:s.sourceIds||[],destination:'body',target:{operationId:argumentOp.id,slot:leadOp?claimSlot(leadOp):'title'},visibleText:s.visibleArgument},...c.contentRouting];
      // sourceLabel is production metadata; content pages do not render a process footer.
      s.compositionBindings=c.bindings;
      s.spatialLayout=c.spatialLayout;s.spatialLanes=c.spatialLanes;
      s.pairedRegions=c.pairedRegions||[];s.contentRegions=c.contentRegions||[];
      if(c.regions)s.regions=c.regions;
      s.relationEdges=c.relationEdges||[];
      s.referenceEdges=c.referenceEdges||[];
    }else if(s.layoutTemplate==='unordered-notes'){
      if(m.length!==1)throw Error('ONE_UNORDERED_GROUP_REQUIRED');
      addTitled(m[0],[60,188,1160,480],'items',{asNotes:true});
    }else if(['paired-open-notes','paired-titled-notes'].includes(s.layoutTemplate)){
      if(m.length!==2)throw Error('TWO_PEER_GROUPS_REQUIRED');
      m.forEach((mm,i)=>addTitled(mm,[44+i*615,183,565,485],'items-'+i,{asNotes:true}));
    }else if(s.layoutTemplate==='parallel-titled-explanations'){
      if(m.length<1||m.length>3)throw Error('ONE_TO_THREE_TITLED_GROUPS_REQUIRED');
      const w=(1200-(m.length-1)*30)/m.length;
      m.forEach((mm,i)=>addTitled(mm,[40+i*(w+30),188,w,480],'explanation-'+i));
    }else if(['parallel-filled-explanations','parallel-badge-explanations'].includes(s.layoutTemplate)){
      if(m.length<1||m.length>4)throw Error('ONE_TO_FOUR_PEER_GROUPS_REQUIRED');
      const w=(1200-(m.length-1)*28)/m.length,kind=s.layoutTemplate==='parallel-filled-explanations'?'column':'badge';
      m.forEach((mm,i)=>ops.push(panel(mm.heading,mm.paras,[40+i*(w+28),188,w,480],kind,17)));
    }else if(s.layoutTemplate==='context-and-notes'){
      if(m.length!==2)throw Error('CONTEXT_AND_NOTES_REQUIRED');
      ops.push(leftContext(m[0],[40,180,1200,132]));
      addTitled(m[1],[65,348,1150,338],'items',{asNotes:true});
    }else if(s.layoutTemplate==='timeline-three-events'){
      if(m.length!==3)throw Error('TIMELINE_REQUIRES_THREE_DATED_EVENTS');
      const fields={},options={},boxes={'47':[55,256,1170,0.001]};
      m.forEach((mm,i)=>{const x=45+i*410;fields['date'+i]=mm.heading;fields['body'+i]=mm.paras;options['date'+i]={font:21,bold:true,color:blue,box:[x,194,380,42]};options['body'+i]={font:17,color:ink,labelBold:true,box:[x,286,380,340],leading:108};boxes[['48','65','66'][i]]=[x+4,248,16,16];if(textHeight(mm.paras,380,17)>340)throw Error('TIMELINE_BODY_CAPACITY: '+i);});
      ops.push(copy('materials-timeline-three',[45,194,1200,432],fields,options,{objectBoxes:boxes}));
    }else if(s.layoutTemplate==='compact-enumerated-list'){
      let y=174;
      m.forEach((mm,i)=>{const h=Math.max(74,textHeight(mm.paras,760,17,{leading:108})+12);if(y+h>690)throw Error('ENUMERATED_LIST_CAPACITY: '+i);ops.push(copy('materials-circle-numbered-row',[42,y,1198,h],{number:String(i+1),heading:mm.heading,body:mm.paras},{number:{font:19,color:'FFFFFF',bold:true,align:'ctr',vAlign:'ctr'},heading:{font:19,color:blue,bold:true,box:[110,y+7,290,h-10]},body:{font:17,color:ink,box:[426,y+7,800,h-10],leading:108}},{objectBoxes:{'77':[42,y+4,43.3,50.4]}}));y+=h+12;});
    }else if(s.layoutTemplate==='two-input-conditions'){
      if(!s.merge?.inputs||s.merge.inputs.length!==2||!s.merge.result)throw Error('TWO_INPUT_MERGE_FIELDS_REQUIRED');
      const h=contentPanelHeight(paras(0),530,17,{maxHeight:300});
      ops.push(panel(m[0].heading,paras(0),[40,174,530,h],'badge'));
      const scale=530/(4747578/9525);ops.push(copy('materials-two-input-merge',[40,198+h,530,1185268/9525*scale],{input0:s.merge.inputs[0],input1:s.merge.inputs[1],result:s.merge.result},{input0:{font:18,vAlign:'ctr'},input1:{font:18,vAlign:'ctr'},result:{font:18,bold:true,vAlign:'ctr'}}));
      let y=178;for(const [i,mm]of m.slice(1).entries()){const h=textHeight(mm.paras,608,17,{leading:108})+80;addTitled(mm,[620,y,620,h],'condition-'+i);y+=h+18;if(y>700)throw Error('CONDITIONS_CAPACITY');}
    }else if(s.layoutTemplate==='definition-two-branch'){
      ops.push(leftContext(m[0],[44,166,1188,90]));
      ops.push(panel(m[1].heading,paras(1),[40,274,583,210],'badge'));
      ops.push(panel(m[2].heading,paras(2),[657,274,583,210],'badge'));
      ops.push(...figure(f[0],[250,485,780,211],30));
    }else if(s.layoutTemplate==='parallel-four-figures'){
      m.forEach((mm,i)=>ops.push(panel(mm.heading,mm.paras,[32+i*312,170,280,332],'column',17)));
      f.forEach((ff,i)=>ops.push(...figure(ff,[36+i*416,519,392,185],83)));
    }else if(s.layoutTemplate==='two-parent-four-child'){
      [0,1].forEach(j=>ops.push(panel(s.parentHeadings[j],[],[40+j*617,170,583,530],'badge')));
      [0,1,2,3].forEach(i=>{
        const col=i<2?0:1,row=i%2,x=55+col*617,y=226+row*173;
        ops.push(text(m[i].heading,[x,y,548,34],20,{bold:true,color:blue}));
        ops.push(text(paras(i),[x,y+36,548,i===3?195:(i===0?133:104)],16.5));
      });
      f.forEach((ff,i)=>ops.push(...figure(ff,[54+i*286,535,272,165],100)));
    }else if(s.layoutTemplate==='parallel-three-shared-figure'){
      m.forEach((mm,i)=>ops.push(panel(mm.heading,mm.paras,[40+i*410,170,380,353],'column',17)));
      ops.push(...figure(f[0],[220,540,840,160],34));
    }else if(s.layoutTemplate==='parallel-three-auxiliary'){
      for(let i=0;i<3;i++)ops.push(panel(m[i].heading,paras(i),[40+i*410,170,380,352],'column',17));
      f.forEach((ff,i)=>ops.push(...figure(ff,[44+i*410,538,370,126],43)));
      ops.push(statement([m[3].heading+'（辅助说明）：'+paras(3).join('')],[44,668,1190,48],13.5));
    }else if(s.layoutTemplate==='interpretation-evidence'){
      ops.push(panel(m[0].heading,paras(0),[40,170,565,210],'badge',17));
      ops.push(panel(m[1].heading,paras(1),[639,170,601,210],'badge',17));
      ops.push(panel(m[2].heading,paras(2),[40,397,565,276],'badge',17));
      const ff=[f[0],f[1],f[2]],bx=[[638,405,188,240],[836,405,194,240],[1040,405,194,240]];
      ff.forEach((a,i)=>ops.push(...figure(a,bx[i],57)));
      ops.push(statement(paras(3),[640,648,594,66],12.5));
    }else if(s.layoutTemplate==='parallel-four-shared-figure'){
      for(let i=0;i<4;i++)ops.push(panel(m[i].heading,paras(i),[40+(i%2)*470,170+Math.floor(i/2)*266,445,256],'column',17));
      ops.push(...figure(f[0],[980,263,270,314],94));
    }else if(s.layoutTemplate==='three-conditions-shared-figure'){
      for(let i=0;i<3;i++)ops.push(panel(m[i].heading,paras(i),[40+i*410,170,380,272],'column',17));
      ops.push(...figure(f[0],[190,460,900,236],35));
    }else if(s.layoutTemplate==='parallel-three-network'){
      for(let i=0;i<3;i++)ops.push(panel(m[i].heading,paras(i),[40+i*410,170,380,280],'column',17));
      ops.push(panel(m[3].heading,paras(3),[40,469,580,235],'badge',17));
      ops.push(...figure(f[0],[650,469,575,235],39));
    }else if(s.layoutTemplate==='three-factors-integrated'){
      for(let i=0;i<3;i++)ops.push(panel(m[i].heading,paras(i),[40+i*410,170,380,250],'column',16.5));
      ops.push(panel(m[3].heading,paras(3),[40,440,535,264],'badge',15.5));
      ops.push(...figure(f[0],[598,440,288,264],157));
      ops.push(...figure(f[1],[930,440,306,121],41));
      ops.push(...figure(f[2],[930,580,306,124],44));
    }else if(s.layoutTemplate==='thesis-three-evidence'){
      ops.push(leftContext(m[0],[45,174,1185,100]));
      for(let i=1;i<4;i++){
        ops.push(panel(m[i].heading,paras(i),[40+(i-1)*410,289,380,208],'column',16.5));
        ops.push(...figure(f[i-1],[46+(i-1)*410,510,368,191],40));
      }
    }else if(s.layoutTemplate==='two-columns-summary'){
      ops.push(panel(m[0].heading,paras(0),[40,170,585,304],'badge',17));
      ops.push(panel(m[1].heading,paras(1),[660,170,580,304],'badge',17));
      ops.push(...figure(f[0],[40,495,585,205],34));
      ops.push(panel(m[2].heading,paras(2),[660,497,580,203],'badge',18));
    }else throw Error('UNREVIEWED_NATIVE_PAGE_LAYOUT: '+s.layoutTemplate);
  }
  pages.push({...s,layoutFamily:s.layoutFamily||s.compositionId||s.layoutTemplate||s.role,contentGroups:groups,operations:ops});
}
fs.mkdirSync(path.dirname(output),{recursive:true});
const compiled=applySpatialPlan(applyNarrativePolicy({...plan,implementation:'materials-native-clone',pages}));
const composition=auditComposition(compiled);
fs.writeFileSync(output+'.composition-audit.json',JSON.stringify(composition,null,2));
fs.writeFileSync(output+'.composition-selection.json',JSON.stringify(compositionSelections,null,2));
fs.writeFileSync(output,JSON.stringify(compiled,null,2));
if(!composition.pass)throw Error('COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(composition.issues));
console.log(JSON.stringify({pages:pages.length,operations:pages.reduce((n,p)=>n+p.operations.length,0),source:'authorized materials and by_human native objects',fallback:0}));
