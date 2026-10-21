import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),out=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-composition-policy-'));
const write=(name,data)=>{const f=path.join(out,name);fs.writeFileSync(f,JSON.stringify(data));return f;};
const word=path.join(out,'source.docx');fs.writeFileSync(word,'source identity fixture; rejection occurs before extraction');
const sha=crypto.createHash('sha256').update(fs.readFileSync(word)).digest('hex');
const source=write('source.json',{source:{path:'source.docx',sha256:sha},blocks:[]});
const manifest=write('manifest.json',{source_word_sha256:sha,assets:[]});
const plan=write('plan.json',{implementation:'materials-native-clone',sourceWord:{sha256:sha},layoutPolicy:{componentSelectionVersion:1},pages:[{id:'bare',role:'content',title:'条件',compositionRationale:'采用简单的纯文字版式。',operations:[{typeId:'materials-text',bounds:[40,180,1200,400],fields:{body:'条件与解释不应直接散排在页面上。'},textOptions:{body:{font:17}}}]}]});
const checks=[];
for(const [name,script,args]of [
  ['standard builder rejects an old-policy hand-authored text page','build_deck.mjs',[plan,source,manifest,path.join(out,'standard')]],
  ['native builder has the same mandatory gate','build_native_deck.mjs',[plan,manifest,path.join(out,'direct')]],
  ['finalization cannot skip the policy','finalize_deck.mjs',[plan,path.join(out,'candidate.pptx'),path.join(out,'final')]],
]){
  const r=spawnSync(process.execPath,[path.join(here,script),...args],{encoding:'utf8'});
  assert.notEqual(r.status,0,name);assert((r.stderr+r.stdout).includes('COMPONENT_COMPOSITION_REVIEW_REQUIRED'),r.stderr+r.stdout);
  checks.push({name,pass:true});
}
assert(!fs.existsSync(path.join(out,'direct','presentation.pptx')));
checks.push({name:'rejected plans do not create a presentation',pass:true});
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({pass:true,checks},null,2));
console.log(JSON.stringify({pass:true,checks:checks.length}));
// Keep the isolated rejection artifacts available for diagnosis; no user files are touched.
