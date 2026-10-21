import fs from 'node:fs';
import {auditRenderedSpatial} from '../assets/spatial-layout.mjs';
const [planPath,bindingsPath,renderedPath,out]=process.argv.slice(2);
if(!out)throw Error('Usage: audit_rendered_spatial.mjs plan.json native-bindings.json powerpoint-check.json report.json');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const audit=auditRenderedSpatial(read(planPath),read(bindingsPath),read(renderedPath));
fs.writeFileSync(out,JSON.stringify(audit,null,2));
console.log(JSON.stringify({pass:audit.pass,pages:audit.pages.length,issues:audit.issues}));
if(!audit.pass)process.exitCode=2;
