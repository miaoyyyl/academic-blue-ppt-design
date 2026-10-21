/** Reposition the existing native five-row directory; no new geometry. */
export const navigationLayout=Object.freeze({panelCenterY:360,rowStart:116,rowStep:104,rowHeight:72,rowX:500.27,rowWidth:595.74});
const rowIds=['166','170','174','178','182'];
const dividerIds=['167','171','175','179','183'];
export function createNavigationOperation({items,activeIndex=0,id}={}){
 if(!Array.isArray(items)||items.length!==5||items.some(s=>typeof s!=='string'||!s.trim()))throw Error('NATIVE_NAVIGATION_FIVE_TITLES_REQUIRED');
 if(!Number.isInteger(activeIndex)||activeIndex<0||activeIndex>=5)throw Error('NATIVE_NAVIGATION_ACTIVE_INDEX_INVALID');
 const fields={},textOptions={},objectBoxes={};
 items.forEach((label,i)=>{
  const y=navigationLayout.rowStart+i*navigationLayout.rowStep,color=i===activeIndex?'004BAD':'65788C';
  fields['item'+i]=label;fields['num'+i]=String(i+1);
  textOptions['item'+i]={font:21,color,bold:i===activeIndex,align:'ctr',vAlign:'ctr',leading:100,box:[647,y+2,425,68]};
  textOptions['num'+i]={font:30,color,bold:true,align:'ctr',vAlign:'ctr',leading:100,box:[512,y+2,115,68]};
  objectBoxes[rowIds[i]]=[navigationLayout.rowX,y,navigationLayout.rowWidth,navigationLayout.rowHeight];
  objectBoxes[dividerIds[i]]=[627.63,y+11,.001,50];
 });
 return {...(id?{id}:{}),typeId:'materials-navigation',bounds:[0,0,1280,720],fields,textOptions,objectBoxes,activeIndex};
}
export function applyNavigationPolicy(input){
 const plan=structuredClone(input);
 plan.navigationPolicy={version:1,content:'chapter-titles-only',alignment:'center',spacing:'equal',showCurrentChapter:true};
 for(const page of plan.pages){
  if(page.role==='toc'&&(page.operations||[]).length!==1)throw Error('DIRECTORY_PAGE_MUST_CONTAIN_ONLY_NATIVE_NAVIGATION: '+page.id);
  if(page.role==='toc'&&!page.operations.some(o=>o.typeId==='materials-navigation'))throw Error('DIRECTORY_NATIVE_NAVIGATION_REQUIRED: '+page.id);
  if(page.operations?.some(o=>o.typeId==='materials-navigation')&&plan.chapters&&plan.chapters.length!==5)throw Error('NATIVE_NAVIGATION_FIVE_CHAPTERS_REQUIRED');
  page.operations=(page.operations||[]).map(op=>{
   if(op.typeId!=='materials-navigation')return op;
   const active=(plan.chapters||[]).findIndex(c=>c.id===page.chapterId);
   const items=plan.chapters?.length===5?plan.chapters.map(c=>c.title):Array.from({length:5},(_,i)=>op.fields?.['item'+i]);
   return createNavigationOperation({items,activeIndex:active>=0?active:(op.activeIndex??0),id:op.id});
  });
  if(page.role==='toc'){
   page.pageTask='展示章节概括并定位当前章节';
   if(page.semanticHierarchy)delete page.semanticHierarchy.chapterThesis;
  }
 }
 return plan;
}
