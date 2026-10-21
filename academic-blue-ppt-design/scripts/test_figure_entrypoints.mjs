import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const out=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-figure-gates-')),here=path.dirname(fileURLToPath(import.meta.url));
const plan=path.join(out,'hidden-key.json');
fs.writeFileSync(plan,JSON.stringify({planningInterface:'WordDeckPlan-v3',implementation:'materials-native-clone',pages:[{id:'p',role:'content',thesis:'关键判断',visibleArgument:'关键判断',operations:[{id:'t',typeId:'materials-text',bounds:[40,180,600,200],fields:{body:'关键判断'}}],modules:[],contentRouting:[{id:'key',sourceIds:['p-001'],importance:'key',destination:'source',sourceText:'关键判断'}]}]}));
const checks=[];
for(const [name,script,args]of [['standard','build_deck.mjs',[plan,'missing-source.json','missing-manifest.json',path.join(out,'standard')]],['native','build_native_deck.mjs',[plan,'missing-manifest.json',path.join(out,'native')]],['finalizer','finalize_deck.mjs',[plan,path.join(out,'candidate.pptx'),path.join(out,'final')]]]){
 // The standard builder reads its inputs before semantic gates; provide neutral readable files.
 if(name==='standard'){for(const f of ['missing-source.json','missing-manifest.json'])fs.writeFileSync(path.join(out,f),'{}');args[1]=path.join(out,'missing-source.json');args[2]=path.join(out,'missing-manifest.json');}
 const r=spawnSync(process.execPath,[path.join(here,script),...args],{encoding:'utf8'});assert.notEqual(r.status,0);assert((r.stderr+r.stdout).includes('KEY_CONTENT_MUST_BE_VISIBLE'),r.stderr+r.stdout);checks.push({name:name+' rejects a hidden key point before authoring',pass:true});
}
assert(!fs.existsSync(path.join(out,'native/presentation.pptx')));checks.push({name:'rejected content does not create a deck',pass:true});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({pass:true,checks},null,2));console.log(JSON.stringify({pass:true,checks:checks.length}));
