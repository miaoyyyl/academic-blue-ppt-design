import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url)),out=path.resolve(process.argv[2]||'qa/regression');fs.mkdirSync(out,{recursive:true});
const names=['test_component_selection','test_native_contract','test_composition_layout','test_relationship_compositions','test_figure_frames','test_visual_policy','test_spatial_layout','test_layout_diversity','test_navigation_layout','test_picture_groups','test_audience_copy','test_component_polish'];
const results=[];
for(const name of names){
 const r=spawnSync(process.execPath,[path.join(folder,name+'.mjs')],{encoding:'utf8',maxBuffer:12*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});let details;
 try{details=JSON.parse(r.stdout.trim());}catch{details={output:r.stdout.trim()};}
 results.push({name,pass:r.status===0,...(r.status?{stderr:r.stderr}:{}),details});
 console.log(name+': '+(r.status===0?'PASS':'FAIL'));
 fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify({pass:results.every(r=>r.pass),results},null,2));
 if(r.status!==0){console.log(r.stderr.slice(-4500));process.exitCode=1;break;}
}
