/** Edit a test copy's native coordinates; planned center metadata must not hide it. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {auditPptxComposition} from '../assets/pptx-composition.mjs';
const [deck,plan,bindings,report]=process.argv.slice(2);
if(!report)throw Error('Usage: test_spatial_pptx.mjs deck.pptx plan.json native-bindings.json report.json');
const positive=auditPptxComposition({deck,plan,bindings});assert.ok(positive.pass,JSON.stringify(positive.issues));
const p=JSON.parse(fs.readFileSync(plan,'utf8')),index=p.pages.findIndex(x=>x.role==='content'&&['labeled-rows','peer-text-panels'].includes(x.compositionId));assert.ok(index>=0);
const row=positive.spatial.pages.find(x=>x.pageId===p.pages[index].id),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-spatial-')),mutated=path.join(dir,'top-heavy.pptx');
const ids=p.pages[index].operations.flatMap((o,i)=>!['materials-frame','human-gradient-statement','materials-caption'].includes(o.typeId)?[i]:[]);
const python=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const code=`
import sys,json,zipfile
from lxml import etree as E
deck,out,page,ids,shift=sys.argv[1:];ids=set(json.loads(ids));shift=float(shift)
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(deck)as z:data={n:z.read(n)for n in z.namelist()}
part='ppt/slides/slide'+page+'.xml';root=E.fromstring(data[part])
for shape in root.find('p:cSld/p:spTree',ns):
 name=shape.find('.//p:cNvPr',ns)
 if name is None:continue
 bits=name.get('name','').split('.')
 if len(bits)<3 or bits[0]!='native' or int(bits[1])not in ids:continue
 x=shape.find('p:spPr/a:xfrm/a:off',ns)
 if x is None:x=shape.find('p:grpSpPr/a:xfrm/a:off',ns)
 if x is not None:x.set('y',str(round(int(x.get('y'))+shift*9525)))
data[part]=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)as z:
 for n,b in data.items():z.writestr(n,b)
`;
const run=spawnSync(python,['-c',code,deck,mutated,String(index+1),JSON.stringify(ids),String(177-row.occupiedBounds[1])],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
const negative=auditPptxComposition({deck:mutated,plan,bindings});assert.ok(negative.issues.some(i=>i.code==='BODY_TOP_HEAVY'));
fs.writeFileSync(report,JSON.stringify({pass:true,checks:[{name:'actual centered PPTX passes',pass:true},{name:'moving real native objects to the top fails despite unchanged plan',pass:true}],mutatedPage:index+1,originalUnmodified:true},null,2));
console.log(JSON.stringify({pass:true,checks:2,mutatedPage:index+1}));
