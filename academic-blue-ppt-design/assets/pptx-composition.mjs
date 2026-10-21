import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {auditComposition} from './composition-policy.mjs';
import {validateNarrativePolicy} from './narrative-layout.mjs';
import {auditPptxAudienceCopy} from './audience-copy.mjs';
import {auditPptxFigures} from './pptx-figures.mjs';
export function auditPptxComposition({deck,plan,bindings,report,python}){
  const executable=python||process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  const inspector=fileURLToPath(new URL('../scripts/read_composition_evidence.py',import.meta.url));
  const read=spawnSync(executable,[inspector,path.resolve(deck),path.resolve(plan),path.resolve(bindings)],{encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  if(read.status!==0)throw Error('PPTX_COMPOSITION_EVIDENCE_FAILED: '+(read.stderr||read.error||read.stdout));
  const evidence=JSON.parse(read.stdout),audit=auditComposition(evidence.plan,{actualEvidence:true});
  audit.issues.unshift(...evidence.issues);
  const narrative=validateNarrativePolicy(evidence.plan);audit.issues.push(...narrative.errors);audit.pass=audit.pass&&narrative.pass;audit.pass=audit.pass&&!evidence.issues.length;
  audit.audienceCopy=auditPptxAudienceCopy({deck,python:executable});
  audit.issues.push(...audit.audienceCopy.issues);audit.pass=audit.pass&&audit.audienceCopy.pass;
  audit.figures=auditPptxFigures({deck,plan,bindings,python:executable});
  audit.issues.push(...audit.figures.issues);audit.pass=audit.pass&&audit.figures.pass;
  const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  audit.actualPptx={sha256:hash(deck),planSha256:hash(plan),bindingsSha256:hash(bindings),textSlots:evidence.textSlots,slides:evidence.slideCount};
  if(report){fs.mkdirSync(path.dirname(path.resolve(report)),{recursive:true});fs.writeFileSync(report,JSON.stringify(audit,null,2));}
  return audit;
}
