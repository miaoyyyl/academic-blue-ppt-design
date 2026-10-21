import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {findCases} from '../assets/native-components/api.mjs';
import {auditComposition} from '../assets/component-selection.mjs';
import {auditPptxComposition} from '../assets/pptx-composition.mjs';
import {assertAudienceCopy} from '../assets/audience-copy.mjs';
import {assertFigurePlan} from '../assets/figure-policy.mjs';

const [planArg,candidateArg,outArg,bindingsArg]=process.argv.slice(2);
if(!outArg)throw Error('用法：node finalize_deck.mjs 规划.json 制作目录/presentation.pptx 新的定稿目录');
const planFile=path.resolve(planArg),candidatePath=path.resolve(candidateArg),out=path.resolve(outArg);
let workspaceDir=path.dirname(planFile);
while([candidatePath,out].some(p=>{const r=path.relative(workspaceDir,p);return r.startsWith('..')||path.isAbsolute(r);})){
  const parent=path.dirname(workspaceDir);if(parent===workspaceDir)throw Error('NO_COMMON_WORKSPACE');workspaceDir=parent;
}
const inside=p=>{const r=path.relative(workspaceDir,p);return r&&!r.startsWith('..')&&!path.isAbsolute(r);};
if(!inside(candidatePath)||!inside(out))throw Error('规划、制作目录和定稿目录须位于同一工作目录内；定稿目录使用新的子目录。');
const plan=JSON.parse(fs.readFileSync(planFile,'utf8').replace(/^\uFEFF/,''));
assertAudienceCopy(plan);
assertFigurePlan(plan);
const composition=auditComposition(plan);
if(!composition.pass)throw Error('COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(composition.issues));
const compositionBindings=bindingsArg||path.join(path.dirname(candidatePath),'native-bindings.json');
if(!fs.existsSync(compositionBindings))throw Error('FINAL_COMPOSITION_BINDINGS_REQUIRED: provide native-bindings.json as the fourth argument.');
fs.mkdirSync(out,{recursive:true});
const actualBefore=auditPptxComposition({deck:candidatePath,plan:planFile,bindings:compositionBindings,report:path.join(out,'candidate-composition-audit.json')});
if(!actualBefore.pass)throw Error('ACTUAL_COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(actualBefore.issues));
const home=process.env.USERPROFILE||process.env.HOME;
if(!process.env.RUNTIME_NODE_MODULES&&!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)process.env.RUNTIME_NODE_MODULES=path.join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const cache=path.join(home,'.codex/plugins/cache/openai-primary-runtime/presentations');
const roots=process.env.PPT_PRESENTATIONS_SKILL_DIR?[process.env.PPT_PRESENTATIONS_SKILL_DIR]:fs.existsSync(cache)?fs.readdirSync(cache).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(v=>path.join(cache,v,'skills/presentations')):[];
const helperRoot=roots.find(r=>fs.existsSync(path.join(r,'container_tools/artifact_tool_utils.mjs')));
if(!helperRoot)throw Error('PRESENTATIONS_RUNTIME_NOT_FOUND：用PPT_PRESENTATIONS_SKILL_DIR指定本机Presentations技能目录。');
const pythonExecutable=process.env.PPT_PYTHON_EXECUTABLE||path.join(home,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const types=new Map(findCases().map(t=>[t.typeId,t]));
const symbolFamilies=[...new Set(plan.pages.flatMap(p=>(p.operations||[]).map(o=>types.get(o.typeId)?.bulletSource?.font?.typeface).filter(Boolean)))];
const owners=family=>plan.pages.flatMap((p,i)=>(p.operations||p.components||[]).some(c=>types.get(c.typeId)?.family===family)?[i+1]:[]);
const tables=owners('table'),charts=owners('chart');
const layoutArgs=['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...tables.flatMap(n=>['--require-native-table-slide',String(n)])];
fs.mkdirSync(out,{recursive:true});
const {finalizePresentation}=await import(pathToFileURL(path.join(helperRoot,'container_tools/artifact_tool_utils.mjs')).href);
await finalizePresentation({workspaceDir,candidatePath,finalPath:path.join(out,'presentation.pptx'),pythonExecutable,
  integrityValidatorPath:path.join(helperRoot,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(helperRoot,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs,explicitTotalSlideCount:plan.pages.length,requiredNativeTableOwnerSlides:tables,requiredNativeChartOwnerSlides:charts,
  ...(charts.length?{nativeChartTargetApplication:'powerpoint',requiredEmbeddedWorkbookChartOwnerSlides:charts}:{}),
  ...(plan.validation?.tableArithmeticContracts?{tableArithmeticContracts:plan.validation.tableArithmeticContracts}:{}),
  fontPolicy:{basis:'design',families:['Microsoft YaHei','DIN Next LT Pro',...symbolFamilies]},verifyArtifactToolImport:true,
  receiptPath:out+'.validation.json'});
const actualFinal=auditPptxComposition({deck:path.join(out,'presentation.pptx'),plan:planFile,bindings:compositionBindings,report:path.join(out,'actual-composition-audit.json'),python:pythonExecutable});
if(!actualFinal.pass)throw Error('FINAL_COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(actualFinal.issues));
console.log(JSON.stringify({ok:true,slides:plan.pages.length,nativeTableOwners:tables,nativeChartOwners:charts,finalPath:path.join(out,'presentation.pptx'),receiptPath:out+'.validation.json'}));
