/** Top-of-page summary typography only; body copy and scientific symbols stay intact. */
const terminalMarks=/[。．.!！?？,，;；:：、…]+$/u;
function clean(text){
  const value=text.trimEnd();
  // Preserve full stops inside a dotted abbreviation such as U.S.
  if(/(?:\b[A-Za-z]\.){2,}$/u.test(value))return value;
  return value.replace(terminalMarks,'').trimEnd();
}
function textLeaves(parent,key,out){
  const value=parent[key];
  if(typeof value==='string')out.push({parent,key});
  else if(Array.isArray(value))value.forEach((_,i)=>textLeaves(value,i,out));
  else if(value&&typeof value==='object'){
    if(typeof value.text==='string')textLeaves(value,'text',out);
    else for(const field of ['paragraphs','runs'])if(field in value)textLeaves(value,field,out);
  }
}
export function normalizeSummaryCopy(value){
  const root={value:structuredClone(value)},leaves=[];
  textLeaves(root,'value',leaves);
  for(const {parent,key}of leaves.toReversed()){
    if(!parent[key].trim())continue;
    parent[key]=clean(parent[key]);
    if(parent[key].trim())break;
  }
  return root.value;
}
export function summaryHasTerminalPunctuation(value){
  const raw={value},leaves=[];textLeaves(raw,'value',leaves);
  const text=leaves.map(({parent,key})=>parent[key]).join('');
  return clean(text)!==text.trimEnd();
}
