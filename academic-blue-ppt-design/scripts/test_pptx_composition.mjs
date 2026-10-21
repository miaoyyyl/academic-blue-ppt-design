/** Integration test: edit copies of a positive fixture, then inspect the actual file. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {auditPptxComposition} from '../assets/pptx-composition.mjs';
const [deck,plan,bindings,report]=process.argv.slice(2);
if(!report)throw Error('Usage: test_pptx_composition.mjs positive.pptx plan.json native-bindings.json report.json; fixture needs a timeline, a capsule and a filled column.');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-actual-composition-'));
const python=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const checks=[];
assert(auditPptxComposition({deck,plan,bindings,python}).pass);checks.push({name:'actual positive PPTX passes',pass:true});
const mutate=`
import json,sys,zipfile
from pathlib import Path
from lxml import etree as E
deck,bindings,out=sys.argv[1:]; bindings=json.loads(Path(bindings).read_text('utf-8-sig'))
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
targets={
 'numeric-font':next(b for b in bindings if b['typeId']=='materials-timeline-three' and b['slot']=='date0'),
 'shrunk-anchor':next(b for b in bindings if b['typeId']=='materials-gradient-tab' and b['slot']=='heading'),
 'shrunk-body':next(b for b in bindings if b['typeId']=='materials-filled-column' and b['slot']=='body')
}
for mode,b in targets.items():
 with zipfile.ZipFile(deck) as z:data={n:z.read(n) for n in z.namelist()}
 part='ppt/slides/slide'+str(b['page'])+'.xml'; root=E.fromstring(data[part])
 name=b['name'] if mode=='numeric-font' else 'native.'+str(b['operation'])+('.33' if mode=='shrunk-anchor' else '.14')
 shape=next(s for s in root.findall('.//p:sp',ns) if s.find('p:nvSpPr/p:cNvPr',ns).get('name')==name)
 if mode=='numeric-font':
  for r in shape.findall('.//a:rPr',ns):r.set('sz','4800')
 else:
  e=shape.find('p:spPr/a:xfrm/a:ext',ns);e.set('cx','9525');e.set('cy','9525')
 data[part]=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
 with zipfile.ZipFile(Path(out)/(mode+'.pptx'),'w',zipfile.ZIP_DEFLATED) as z:
  for n,v in data.items():z.writestr(n,v)
`;
const result=spawnSync(python,['-c',mutate,path.resolve(deck),path.resolve(bindings),out],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
for(const [mode,code]of [['numeric-font','NUMERIC_SPOTLIGHT_FORBIDDEN'],['shrunk-anchor','INVALID_CONTENT_GROUP'],['shrunk-body','STRUCTURED_TEXT_OUTSIDE_COMPONENT']]){
  const r=auditPptxComposition({deck:path.join(out,mode+'.pptx'),plan,bindings,python,report:path.join(out,mode+'.json')});
  assert(!r.pass&&r.issues.some(i=>i.code===code),JSON.stringify(r.issues));checks.push({name:mode+' is detected from exported shapes',pass:true});
}
fs.writeFileSync(report,JSON.stringify({pass:true,checks,isolatedArtifacts:out},null,2));
console.log(JSON.stringify({pass:true,checks:checks.length}));
