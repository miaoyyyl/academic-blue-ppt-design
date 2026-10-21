import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {bankDir,renderComponent} from '../assets/native-components/api.mjs';
import {auditComposition} from '../assets/component-selection.mjs';
import {auditPptxComposition} from '../assets/pptx-composition.mjs';
import {assertAudienceCopy} from '../assets/audience-copy.mjs';
import {assertFigurePlan,assertFigureAssets} from '../assets/figure-policy.mjs';

const [planFile,manifestFile,outDir]=process.argv.slice(2);
if(!outDir)throw new Error('Usage: build_native_deck.mjs native-plan.json asset-manifest.json output');
const plan=JSON.parse(fs.readFileSync(planFile,'utf8').replace(/^\uFEFF/,''));
assertAudienceCopy(plan);
assertFigurePlan(plan);
assertFigureAssets(plan,JSON.parse(fs.readFileSync(manifestFile,'utf8').replace(/^\uFEFF/,'')));
fs.mkdirSync(outDir,{recursive:true});
const composition=auditComposition(plan);
fs.writeFileSync(path.resolve(outDir,'composition-audit.json'),JSON.stringify(composition,null,2));
if(!composition.pass)throw Error('COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(composition.issues));
const {Presentation,PresentationFile}=await import('../assets/runtime.mjs');
const deck=Presentation.create({slideSize:{width:1280,height:720}});
const ops={pages:[]};
for(const page of plan.pages){
  const slide=deck.slides.add();slide.nativeOperations=[];
  if(page.notes)slide.speakerNotes.text=Array.isArray(page.notes)?page.notes.join('\n'):page.notes;
  for(const operation of page.operations){
    const result=await renderComponent({typeId:operation.typeId,slide,bounds:operation.bounds,content:operation});
    if(!result.ok)throw new Error(JSON.stringify({page:page.id,...result}));
  }
  ops.pages.push({id:page.id,operations:slide.nativeOperations});
}
const seed=path.resolve(outDir,'artifact-seed.pptx');await(await PresentationFile.exportPptx(deck)).save(seed);
const operations=path.resolve(outDir,'native-operations.json');fs.writeFileSync(operations,JSON.stringify(ops,null,2));
const py=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const backend=path.join(path.dirname(fileURLToPath(import.meta.url)),'native_components.py');
const result=spawnSync(py,[backend,'render',bankDir,operations,seed,path.resolve(outDir,'presentation.pptx'),path.resolve(manifestFile)],{encoding:'utf8',maxBuffer:4*1024*1024});
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);if(result.status!==0)process.exit(result.status||1);
const actual=auditPptxComposition({deck:path.resolve(outDir,'presentation.pptx'),plan:planFile,bindings:path.resolve(outDir,'native-bindings.json'),report:path.resolve(outDir,'actual-composition-audit.json'),python:py});
if(!actual.pass)throw Error('ACTUAL_COMPONENT_COMPOSITION_REVIEW_REQUIRED: '+JSON.stringify(actual.issues));
