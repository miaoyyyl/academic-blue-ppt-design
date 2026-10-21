import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {auditPptxComposition} from '../assets/pptx-composition.mjs';
const [deck,plan,bindings,out]=process.argv.slice(2);if(!out)throw Error('Usage: test_pptx_component_polish.mjs deck plan bindings output');
const python=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
fs.mkdirSync(out,{recursive:true});
const positive=auditPptxComposition({deck,plan,bindings,python});assert(positive.pass,JSON.stringify(positive.issues));
const r=spawnSync(python,[fileURLToPath(new URL('./mutate_component_polish.py',import.meta.url)),deck,bindings,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
const fixtures=JSON.parse(fs.readFileSync(path.join(out,'fixtures.json'))),checks=[{name:'positive native file',pass:positive.pass}];
for(const f of fixtures){const bad=auditPptxComposition({deck:f.file,plan,bindings,python});checks.push({name:f.name,pass:!bad.pass,codes:[...new Set(bad.issues.map(i=>i.code))]});}
const report={pass:checks.every(c=>c.pass),checks};fs.writeFileSync(path.join(out,'actual-polish-regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.pass)process.exitCode=1;
