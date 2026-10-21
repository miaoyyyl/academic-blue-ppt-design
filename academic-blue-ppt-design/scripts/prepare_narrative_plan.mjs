import fs from 'node:fs';import path from 'node:path';
import {applyNarrativePolicy,validateNarrativePolicy} from '../assets/narrative-layout.mjs';
const [input,output]=process.argv.slice(2);
if(!output||path.resolve(input)===path.resolve(output))throw Error('Use separate input and output plan files');
const plan=applyNarrativePolicy(JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'')));
const check=validateNarrativePolicy(plan);if(!check.pass)throw Error(JSON.stringify(check));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(plan,null,2));console.log(JSON.stringify({pages:plan.pages.length,...check}));
