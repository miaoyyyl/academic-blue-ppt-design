import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNavigationOperation} from '../navigation-layout.mjs';
import {normalizeImageCrop} from '../figure-policy.mjs';
import {polishNativeOperation} from '../component-polish.mjs';
export const bankDir=path.dirname(fileURLToPath(import.meta.url));
export function findCases(filters={}) {
  let list=JSON.parse(fs.readFileSync(path.join(bankDir,'registry.json'),'utf8'));
  if(filters.typeId)list=list.filter(x=>x.typeId===filters.typeId);
  if(filters.relation)list=list.filter(x=>x.relation===filters.relation);
  if(filters.role)list=list.filter(x=>x.relation===filters.role);
  if(filters.sourcePage!=null)list=list.filter(x=>x.sourcePage===Number(filters.sourcePage));
  if(filters.itemCount!=null)list=list.filter(x=>(x.repeatable&&Number(filters.itemCount)>0)||x.itemCount===Number(filters.itemCount));
  if(filters.contentTask)list=list.filter(x=>x.contentTasks?.includes(filters.contentTask));
  if(filters.contentStructure)list=list.filter(x=>x.contentStructures?.includes(filters.contentStructure));
  if(filters.visualTreatment)list=list.filter(x=>x.visualTreatment===filters.visualTreatment);
  if(filters.markerRole)list=list.filter(x=>x.markerRole===filters.markerRole);
  return list;
}
// Native objects are copied at commit; never approximate a missing source with drawn boxes.
export async function renderComponent({typeId,slide,bounds,content={},assets={}}) {
  const type=findCases({typeId})[0];
  if(!type)return {ok:false,errors:[{code:'MATERIAL_NATIVE_COMPONENT_NOT_FOUND',typeId}],bindings:[]};
  if(Object.values(content.textOptions||{}).some(o=>o.vAlign&&!['t','ctr','b'].includes(o.vAlign)))return {ok:false,errors:[{code:'NATIVE_VERTICAL_ALIGNMENT_INVALID'}],bindings:[]};
  try{content=polishNativeOperation({...content,typeId,bounds});bounds=content.bounds;}catch(error){return {ok:false,errors:[{code:error.message}],bindings:[]};}
  if(!bounds||bounds.length!==4||bounds.some(n=>!Number.isFinite(n))||bounds[0]<0||bounds[1]<0||bounds[2]<=0||bounds[3]<=0||bounds[0]+bounds[2]>1280.1||bounds[1]+bounds[3]>720.1)
    return {ok:false,errors:[{code:'NATIVE_BOUNDS_INVALID'}],bindings:[]};
  if(!slide?.nativeOperations)return {ok:false,errors:[{code:'NATIVE_SLIDE_CONTEXT_REQUIRED'}],bindings:[]};
  const unknown=Object.keys(content.fields||{}).filter(k=>!(k in type.slots));
  if(unknown.length)return {ok:false,errors:[{code:'NATIVE_SLOT_UNKNOWN',slots:unknown}],bindings:[]};
  if(typeId==='materials-navigation'){
    if(bounds.some((v,i)=>v!==[0,0,1280,720][i]))return {ok:false,errors:[{code:'NATIVE_NAVIGATION_FULL_CANVAS_REQUIRED'}],bindings:[]};
    try{const normalized=createNavigationOperation({items:Array.from({length:5},(_,i)=>content.fields?.['item'+i]),activeIndex:content.activeIndex??0});content={...content,...normalized};}
    catch(error){return {ok:false,errors:[{code:error.message}],bindings:[]};}
  }
  if('image'in type.slots&&!content.assetId)return {ok:false,errors:[{code:'NATIVE_IMAGE_REQUIRED'}],bindings:[]};
  if(content.imageAlign&&!['center','left-top','right-top'].includes(content.imageAlign))return {ok:false,errors:[{code:'NATIVE_IMAGE_ALIGNMENT_INVALID'}],bindings:[]};
  if(content.imageCrop!==undefined){
    try{normalizeImageCrop(content.imageCrop);}catch(error){return {ok:false,errors:[{code:'IMAGE_CROP_INVALID',message:error.message}],bindings:[]};}
    if(!('image'in type.slots))return {ok:false,errors:[{code:'IMAGE_CROP_ON_NON_IMAGE'}],bindings:[]};
  }
  if(Object.values(content.textOptions||{}).some(o=>o.vAlign&&!['t','ctr','b'].includes(o.vAlign)))return {ok:false,errors:[{code:'NATIVE_VERTICAL_ALIGNMENT_INVALID'}],bindings:[]};
  const fields={...(content.fields||{})},textOptions={};
  for(const slot of new Set([...Object.keys(type.defaultTextOptions||{}),...Object.keys(content.textOptions||{})])){
    if(!(slot in type.slots))return {ok:false,errors:[{code:'NATIVE_TEXT_OPTION_SLOT_UNKNOWN',slot}],bindings:[]};
    textOptions[slot]={...(type.defaultTextOptions?.[slot]||{}),...(content.textOptions?.[slot]||{})};
    const option=textOptions[slot];
    if(option.bullet&&!['none','source'].includes(option.bullet))return {ok:false,errors:[{code:'NATIVE_BULLET_MODE_INVALID',slot}],bindings:[]};
    if(option.bullet==='source'&&!type.bulletSource)return {ok:false,errors:[{code:'NATIVE_BULLET_TEMPLATE_MISSING',slot}],bindings:[]};
    if(option.paragraphAfter!=null&&(!Number.isFinite(option.paragraphAfter)||option.paragraphAfter<0||option.paragraphAfter>72))return {ok:false,errors:[{code:'NATIVE_PARAGRAPH_SPACING_INVALID',slot}],bindings:[]};
    const strings=Array.isArray(fields[slot])?fields[slot]:[String(fields[slot]??'')];
    if(option.emphasis!=null&&(!Array.isArray(option.emphasis)||option.emphasis.some(e=>!e||typeof e.text!=='string'||!e.text||!strings.some(s=>String(s).includes(e.text))||!/^#?[0-9A-Fa-f]{6}$/.test(e.color||'C00000'))))return {ok:false,errors:[{code:'NATIVE_EMPHASIS_INVALID_OR_NOT_IN_TEXT',slot}],bindings:[]};
    if(!(slot in fields)&&option.bullet==='source')fields[slot]=[];
  }
  if(type.family==='table'){
    for(const [key,n]of [['tableColumnWeights',type.tableShape.columns],['tableRowWeights',type.tableShape.rows]])if(content[key]&&(!Array.isArray(content[key])||content[key].length!==n||content[key].some(v=>!Number.isFinite(v)||v<=0)))return {ok:false,errors:[{code:'NATIVE_TABLE_WEIGHTS_INVALID',key}],bindings:[]};
  }
  if(content.nativeTransform&&Object.entries(content.nativeTransform).some(([k,v])=>!['flipH','flipV'].includes(k)||typeof v!=='boolean'))return {ok:false,errors:[{code:'NATIVE_TRANSFORM_INVALID'}],bindings:[]};
  if(content.nativeTransform&&!['materials-feedback-return','materials-flow-arrow','materials-gradient-connector','materials-brace-group'].includes(typeId))return {ok:false,errors:[{code:'NATIVE_TRANSFORM_VECTOR_ONLY'}],bindings:[]};
  const op={id:content.id,componentTask:content.componentTask,selectionReason:content.selectionReason,figureFrame:content.figureFrame,regionId:content.regionId,regionContainer:content.regionContainer,headingAttachment:content.headingAttachment,relationEdge:content.relationEdge,relationEvidence:content.relationEvidence,annotationBinding:content.annotationBinding,nativeTransform:content.nativeTransform,semanticRole:content.semanticRole,typeId,bounds,fields,assetId:content.assetId,imageAlign:content.imageAlign,...(content.imageCrop!==undefined?{imageCrop:normalizeImageCrop(content.imageCrop)}:{}),textOptions,objectBoxes:content.objectBoxes||{},tableAppearance:content.tableAppearance,tableColumnWeights:content.tableColumnWeights,tableRowWeights:content.tableRowWeights,activeIndex:content.activeIndex,source:type.sourceFile,sourcePage:type.sourcePage};
  slide.nativeOperations.push(op);
  return {ok:true,mode:'native-clone',pendingCommit:true,bindings:Object.entries(type.slots).map(([slot,sourceObjectId])=>({slot,sourceObjectId,sourceFile:type.sourceFile,sourcePage:type.sourcePage})),errors:[]};
}
