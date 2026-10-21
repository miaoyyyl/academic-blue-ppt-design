/** Shared placement of existing native objects; no replacement drawing geometry. */
const TABLES=new Set(['human-comparison-table','human-response-table']);
const slots=['input0','input1','result'];
const BACKS={input0:'107',input1:'109',result:'111'};
const flat=v=>Array.isArray(v)?v.join('\n'):String(v??'');
const valid=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[2]>0&&b[3]>0;
const near=(a,b,t=2)=>valid(a)&&valid(b)&&a.every((v,i)=>Math.abs(v-b[i])<=t);
const units=s=>[...s].reduce((n,c)=>n+(/[\u2E80-\u9FFF\uFF00-\uFFEF]/u.test(c)?1:/[A-Z0-9]/.test(c)?.63:.52),0);
const inkWidth=(s,f)=>Math.max(...flat(s).split('\n').map(t=>units(t)*f*4/3));
function lineHeight(s,w,f){return flat(s).split('\n').reduce((n,t)=>n+Math.max(1,Math.ceil(units(t)*f*4/3/w)),0)*f*4/3*1.12;}
export const TABLE_APPEARANCE='uniform-white-blue';

export function polishNativeOperation(input){
 const o={...input,textOptions:structuredClone(input.textOptions||{}),objectBoxes:structuredClone(input.objectBoxes||{})};
 if(TABLES.has(o.typeId)){
  if(o.tableAppearance&&o.tableAppearance!==TABLE_APPEARANCE)throw Error('TABLE_APPEARANCE_UNREGISTERED');
  o.tableAppearance=TABLE_APPEARANCE;
  for(const slot of Object.keys(o.fields||{}))if(/^cell\d+_\d+$/.test(slot))o.textOptions[slot]={color:slot.startsWith('cell0_')?'004BAD':'162B40',...(slot.startsWith('cell0_')?{bold:true}:{}),...o.textOptions[slot]};
 }else if(o.tableAppearance)throw Error('TABLE_APPEARANCE_ON_NON_TABLE');
 if(o.typeId==='materials-two-input-merge'){
  const [x,y,w,h]=o.bounds,gap=30,pad=20,fonts=slots.map(s=>o.textOptions[s]?.font||17),maxWidth=(w-gap)/2;
  const ws=slots.map((s,i)=>Math.min(i===2?w:maxWidth,Math.max(96,inkWidth(o.fields?.[s],fonts[i])+pad*2)));
  const hs=slots.map((s,i)=>Math.max(50,Math.ceil(lineHeight(o.fields?.[s],ws[i]-pad*2,fonts[i])+16)));
  const topH=Math.max(hs[0],hs[1]),cluster=ws[0]+ws[1]+gap,left=x+(w-cluster)/2;
  ws[2]=Math.max(ws[2],ws[0]/2+gap+ws[1]/2+32);
  const resultY=y+h-hs[2],space=resultY-y-topH;
  if(space<24||ws[2]>w+.01)throw Error('MERGE_NODE_CAPACITY');
  const boxes=[[left,y,ws[0],topH],[left+ws[0]+gap,y,ws[1],topH],[x+(w-ws[2])/2,resultY,ws[2],hs[2]]];
  slots.forEach((s,i)=>{
   const b=boxes[i];o.objectBoxes[BACKS[s]]=b;
   o.textOptions[s]={...o.textOptions[s],font:fonts[i],align:'ctr',vAlign:'ctr',inset:0,leading:112,paragraphAfter:0,box:[b[0]+12,b[1]+6,b[2]-24,b[3]-12]};
  });
  for(let i=0;i<2;i++)o.objectBoxes[String(86+i)]=[boxes[i][0]+boxes[i][2]/2-8,y+topH+(space-12)/2,16,12];
 }
 if(o.typeId==='materials-folded-tab'){
  const [x,y,w,h]=o.bounds,font=o.textOptions.heading?.font||20;
  const width=Math.min(w,Math.max(120,inkWidth(o.fields?.heading,font)+40));
  const blueH=Math.max(44,Math.ceil(lineHeight(o.fields?.heading,width-32,font)+14));
  const height=Math.max(h,blueH*515541/393169);o.bounds=[x,y,width,height];
  o.objectBoxes['23']=[x,y,width,blueH];
  // Source triangle 22 is rotated 270deg; keep its visible 14x12 fold attached.
  o.objectBoxes['22']=[x+1,y+blueH-1,12,14];
  o.textOptions.heading={...o.textOptions.heading,font,align:'ctr',vAlign:'ctr',inset:0,leading:112,paragraphAfter:0,box:[x+16,y+4,width-32,blueH-8]};
 }
 if(o.typeId==='materials-compact-label'){
  const [x,y,w,h]=o.bounds,font=o.textOptions.label?.font||18,nw=Math.min(w,Math.max(96,Math.ceil(inkWidth(o.fields?.label,font)+36))),b=[x+(w-nw)/2,y,nw,h];
  o.bounds=b;o.objectBoxes['123']=b;
  o.textOptions.label={...o.textOptions.label,font,align:'ctr',vAlign:'ctr',inset:0,leading:108,paragraphAfter:0,box:[b[0]+14,y+6,nw-28,h-12]};
 }
 return o;
}

/** A bound folded title may bleed left; body objects never inherit this exception. */
export function attachedHeadingFits(o,r,frame,actual=false){
 if(o?.typeId!=='materials-folded-tab'||o.id!==r.headingOperationId||o.semanticRole!=='region-heading'||o.headingAttachment?.frameOperationId!==r.frameOperationId)return false;
 const b=actual?o._actualOperationBounds||o.bounds:o.bounds,f=actual?frame?._actualOperationBounds||frame?.bounds:frame?.bounds;
 if(!valid(b)||!valid(f))return false;
 const outset=f[0]-b[0];
 return outset>=8&&outset<=24&&Math.abs(b[1]-(f[1]-12))<=3&&b[0]>=0&&b[0]+b[2]<=r.bounds[0]+r.bounds[2]+3&&b[1]+b[3]<=r.bounds[1]+r.bounds[3]+3;
}

export function auditComponentPolish(plan,{actualEvidence=false}={}){
 const issues=[];
 for(const p of plan.pages||[]){
  if(p.role!=='content')continue;
  for(const o of p.operations||[]){
   const add=(code,d={})=>issues.push({code,pageId:p.id,operationId:o.id,typeId:o.typeId,...d});
   let expected;try{expected=polishNativeOperation(o);}catch(e){add(e.message);continue;}
   if(TABLES.has(o.typeId)){
    if(actualEvidence){const t=o._actualTableAppearance;if(!t||t.bandRow||t.bandCol||!t.fills?.length||t.fills.some(c=>c!=='FFFFFF'))add('ACTUAL_TABLE_FILL_POLICY',{actual:t});}
   }
   if(o.typeId==='materials-two-input-merge')for(const slot of slots){
    const opt=o.textOptions?.[slot]||{};
    if(opt.align&&opt.align!=='ctr'||opt.vAlign&&opt.vAlign!=='ctr')add('MERGE_TEXT_ALIGNMENT',{slot});
    if(actualEvidence){
     const b=o._actualNativeBoxes?.[BACKS[slot]],tb=o._actualSlotBoxes?.[slot],anch=o._actualTextAnchors?.[slot],align=o._actualParagraphAlignments?.[slot];
     if(anch!=='ctr'||!align?.length||align.some(a=>a!=='ctr'))add('ACTUAL_MERGE_TEXT_ALIGNMENT',{slot,anch,align});
     if(!near(b,expected.objectBoxes[BACKS[slot]]))add('ACTUAL_MERGE_NODE_SIZE',{slot,actual:b,expected:expected.objectBoxes[BACKS[slot]]});
     if(!valid(b)||!valid(tb)||Math.abs(b[0]+b[2]/2-tb[0]-tb[2]/2)>2||Math.abs(b[1]+b[3]/2-tb[1]-tb[3]/2)>2)add('ACTUAL_MERGE_TEXT_CENTER',{slot});
    }
   }
   if(o.typeId==='materials-folded-tab'){
    const r=(p.contentRegions||[]).find(r=>r.headingOperationId===o.id),frame=r&&(p.operations||[]).find(f=>f.id===r.frameOperationId);
    if(r&&!attachedHeadingFits(o,r,frame,actualEvidence))add('FOLDED_TITLE_ATTACHMENT');
    if(actualEvidence){const b=o._actualNativeBoxes?.['23'],tb=o._actualSlotBoxes?.heading;
     if(o._actualTextAnchors?.heading!=='ctr'||o._actualParagraphAlignments?.heading?.some(a=>a!=='ctr'))add('ACTUAL_FOLDED_TEXT_ALIGNMENT');
     if(!valid(b)||b[3]<42||!near(b,expected.objectBoxes['23'])||!valid(tb)||Math.abs(b[0]+b[2]/2-tb[0]-tb[2]/2)>2||Math.abs(b[1]+b[3]/2-tb[1]-tb[3]/2)>2)add('ACTUAL_FOLDED_TEXT_CENTER',{blue:b,text:tb});
    }
   }
   if(o.typeId==='materials-compact-label'&&actualEvidence){
    const b=o._actualNativeBoxes?.['123'],tb=o._actualSlotBoxes?.label;
    if(!near(b,expected.objectBoxes['123'])||o._actualTextAnchors?.label!=='ctr'||o._actualParagraphAlignments?.label?.some(a=>a!=='ctr')||!valid(tb)||Math.abs(b[0]+b[2]/2-tb[0]-tb[2]/2)>2||Math.abs(b[1]+b[3]/2-tb[1]-tb[3]/2)>2)add('ACTUAL_COMPACT_LABEL_GEOMETRY');
   }
   const boundCaption=o.id&&(p.supportFigures||[]).some(f=>f.captionOperationId===o.id);
   const b=actualEvidence?o._actualOperationBounds||o.bounds:o.bounds;
   if(o.typeId==='materials-caption'&&!boundCaption&&b?.[1]>=670&&Object.values(o._actualFields||o.fields||{}).some(v=>flat(v).trim()))add('CONTENT_PROCESS_FOOTER_FORBIDDEN');
  }
 }
 return {policyVersion:1,pass:issues.length===0,issues};
}
