/** Optional input isolation: deny reads of sibling projects while building a copied task. */
import fs from 'node:fs';
import path from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
const root=process.env.PPT_ISOLATION_ROOT&&path.resolve(process.env.PPT_ISOLATION_ROOT);
const project=process.env.PPT_EXCLUDED_PROJECT_ROOT&&path.resolve(process.env.PPT_EXCLUDED_PROJECT_ROOT);
if(root&&project){
 const inside=(p,r)=>{const rel=path.relative(r,p);return rel===''||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
 const phase=process.env.PPT_ISOLATION_PHASE||'',suffix=phase?'-'+phase.replace(/[^A-Za-z0-9_-]/g,''):'';
 const log=path.join(root,'isolation-node-io'+suffix+'.jsonl'),append=fs.appendFileSync.bind(fs);
 const check=(value,method)=>{
  if(typeof value==='number'||value==null)return;
  let file;try{file=value instanceof URL?path.resolve(decodeURIComponent(value.pathname.replace(/^\/(?=[A-Za-z]:)/,''))):path.resolve(String(value));}catch{return;}
  const denied=inside(file,project)&&!inside(file,root);
  if(inside(file,project))append(log,JSON.stringify({method,path:file,denied})+'\n');
  if(denied)throw Error('ISOLATED_PROJECT_READ_DENIED: '+file);
 };
 for(const method of ['readFileSync','readFile','openSync','open','readdirSync','readdir','createReadStream']){const original=fs[method].bind(fs);fs[method]=function(file,...args){check(file,method);return original(file,...args);};}
 for(const method of ['readFile','open','readdir']){const original=fs.promises[method].bind(fs.promises);fs.promises[method]=function(file,...args){check(file,'promises.'+method);return original(file,...args);};}
 syncBuiltinESMExports();
}
