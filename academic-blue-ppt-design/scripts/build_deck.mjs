/** Active Word entry point. Legacy geometry cannot be selected accidentally. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateNarrativePolicy} from '../assets/narrative-layout.mjs';
import {auditComposition} from '../assets/component-selection.mjs';
import {assertAudienceCopy} from '../assets/audience-copy.mjs';
import {assertFigurePlan} from '../assets/figure-policy.mjs';
const [planFile,sourceFile,manifestFile,out]=process.argv.slice(2);
if(!out)throw Error('Usage: build_deck.mjs native-plan.json source-bundle.json asset-manifest.json output');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const plan=read(planFile),source=read(sourceFile),manifest=read(manifestFile);
assertAudienceCopy(plan);
assertFigurePlan(plan);
if(plan.layoutPolicy?.version>=3){const policy=validateNarrativePolicy(plan);if(!policy.pass)throw Error('NARRATIVE_LAYOUT_POLICY: '+JSON.stringify(policy.errors));}
if(plan.implementation!=='materials-native-clone'||!plan.pages.every(p=>Array.isArray(p.operations)))
  throw Error('MATERIALS_NATIVE_PLAN_REQUIRED: simplified v1 geometry is retired.');
if(source.source.sha256!==manifest.source_word_sha256||source.source.sha256!==plan.sourceWord.sha256)
  throw Error('SOURCE_HASH_MISMATCH');
const word=path.resolve(path.dirname(path.resolve(sourceFile)),source.source.path);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
if(!fs.existsSync(word)||hash(word)!==source.source.sha256)throw Error('SOURCE_WORD_CHANGED');
const sourceIds=new Set(source.blocks.map(b=>b.id));
for(const p of plan.pages)for(const id of [...(p.sourceIds||[]),...(p.modules||[]).flatMap(m=>m.sourceIds||[]),...(p.contentRouting||[]).flatMap(r=>r.sourceIds||[])])
  if(!sourceIds.has(id))throw Error('UNKNOWN_SOURCE_ID: '+id);
fs.mkdirSync(out,{recursive:true});
const composition=auditComposition(plan);
fs.writeFileSync(path.join(out,'composition-audit.json'),JSON.stringify(composition,null,2));
if(!composition.pass)throw Error('COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(composition.issues));
fs.writeFileSync(path.join(out,'input-access.json'),JSON.stringify([planFile,sourceFile,manifestFile,word].map(f=>({path:path.resolve(f),sha256:hash(f)})),null,2));
process.argv=[process.argv[0],process.argv[1],path.resolve(planFile),path.resolve(manifestFile),path.resolve(out)];
await import('./build_native_deck.mjs');
