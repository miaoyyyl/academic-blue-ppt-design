/** Actual-file regressions: source window, displayed geometry and media identity. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {auditPptxFigures} from '../assets/pptx-figures.mjs';
const [deck,plan,bindings,report]=process.argv.slice(2);if(!report)throw Error('Usage: test_pptx_figures.mjs deck plan bindings report');
const python=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-figures-')),checks=[];
const base=auditPptxFigures({deck,plan,bindings,python});assert(base.pass);checks.push({name:'actual source windows and source hashes pass',pass:true});
const mutate=String.raw`
from pathlib import Path
import json,sys,zipfile,posixpath
from lxml import etree as E
deck,planfile,bindingsfile,out=sys.argv[1:]
plan=json.loads(Path(planfile).read_text('utf-8-sig'));bindings=json.loads(Path(bindingsfile).read_text('utf-8-sig'))
binding=next(b for b in bindings if b.get('slot')=='image' and any(b.get('imageCrop',[])))
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
for mode in ['crop-removed','stretched','media-changed']:
 with zipfile.ZipFile(deck)as z:data={n:z.read(n)for n in z.namelist()}
 part=f"ppt/slides/slide{binding['page']}.xml";root=E.fromstring(data[part]);shape=next(s for s in root.findall('.//p:pic',ns)if s.find('p:nvPicPr/p:cNvPr',ns).get('name')==binding['name'])
 if mode=='crop-removed':
  fill=shape.find('p:blipFill',ns);sr=fill.find('a:srcRect',ns);fill.remove(sr)
 elif mode=='stretched':
  ext=shape.find('p:spPr/a:xfrm/a:ext',ns);ext.set('cx',str(round(int(ext.get('cx'))*1.2)))
 else:
  rid=shape.find('p:blipFill/a:blip',ns).get('{'+ns['r']+'}embed');rels=E.fromstring(data[f"ppt/slides/_rels/slide{binding['page']}.xml.rels"]);rel=next(r for r in rels if r.get('Id')==rid);media=posixpath.normpath('ppt/slides/'+rel.get('Target'));data[media]+=b'qa-mutation'
 data[part]=E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
 with zipfile.ZipFile(Path(out)/(mode+'.pptx'),'w',zipfile.ZIP_DEFLATED)as z:
  for n,b in data.items():z.writestr(n,b)
`;
const result=spawnSync(python,['-c',mutate,path.resolve(deck),path.resolve(plan),path.resolve(bindings),out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
for(const [mode,code]of [['crop-removed','ACTUAL_IMAGE_CROP_CHANGED'],['stretched','ACTUAL_IMAGE_DISPLAY_BOUNDS_CHANGED'],['media-changed','ACTUAL_IMAGE_ASSET_CHANGED']]){
 const r=auditPptxFigures({deck:path.join(out,mode+'.pptx'),plan,bindings,python});assert(!r.pass&&r.issues.some(i=>i.code===code),JSON.stringify(r.issues));checks.push({name:mode+' is detected in actual PPTX',pass:true});
}
fs.writeFileSync(report,JSON.stringify({pass:true,checks},null,2));console.log(JSON.stringify({pass:true,checks:checks.length}));
