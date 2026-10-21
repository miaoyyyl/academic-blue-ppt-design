import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {auditAudienceCopy,auditPptxAudienceCopy} from '../assets/audience-copy.mjs';
const [report,negativeDeck,positiveDeck]=process.argv.slice(2),checks=[];
const plan=text=>({pages:[{id:'example',pageTask:'原文的来源分析不用于展示。',notes:['解释边界：保留引用。'],operations:[{id:'example.text',fields:{body:text}}]}]});
for(const text of ['原文指出过程A可能影响指标B。','解释边界','解释\n边界','仍以“可能”表述','原图未列该字段。','不将未读清项算作覆盖。','正文未展开其贡献。']){
  assert(!auditAudienceCopy(plan(text)).pass,text);checks.push({name:'rejects visible editorial copy: '+text,pass:true});
}
for(const text of ['过程A可能影响指标B。','该效应通常受温度和剂量影响。','目前尚缺长期实证。','不同单位的结果不宜直接比较。','研究[3]报道A与B相关。','边界层厚度随流速变化。','实验边界条件：入口温度25 ℃。','原图与增强图的信噪比比较。','OR：指标A；CK：指标B。']){
  assert(auditAudienceCopy(plan(text)).pass,text);checks.push({name:'keeps scientific qualification: '+text,pass:true});
}
const out=fs.mkdtempSync(path.join(os.tmpdir(),'ppt-audience-copy-')),here=path.dirname(fileURLToPath(import.meta.url));
const write=(name,data)=>{const f=path.join(out,name);fs.writeFileSync(f,JSON.stringify(data));return f;};
const word=path.join(out,'source.docx');fs.writeFileSync(word,'identity fixture; gate executes before rendering');
const sha=crypto.createHash('sha256').update(fs.readFileSync(word)).digest('hex');
const source=write('source.json',{source:{path:'source.docx',sha256:sha},blocks:[]}),manifest=write('manifest.json',{source_word_sha256:sha,assets:[]});
const bad=plan('原文指出过程A可能影响指标B。');bad.implementation='materials-native-clone';bad.sourceWord={sha256:sha};
const badFile=write('bad.json',bad);
for(const [script,args]of [
  ['build_deck.mjs',[badFile,source,manifest,path.join(out,'standard')]],
  ['build_native_deck.mjs',[badFile,manifest,path.join(out,'native')]],
  ['finalize_deck.mjs',[badFile,path.join(out,'candidate.pptx'),path.join(out,'final')]],
]){
  const r=spawnSync(process.execPath,[path.join(here,script),...args],{encoding:'utf8'});
  assert.notEqual(r.status,0,script);assert((r.stderr+r.stdout).includes('AUDIENCE_COPY_REVIEW_REQUIRED'),r.stderr+r.stdout);
  checks.push({name:script+' rejects editorial copy before output',pass:true});
}
if(negativeDeck){assert(!auditPptxAudienceCopy({deck:negativeDeck}).pass);checks.push({name:'actual existing deck exposes editorial copy',pass:true});}
if(positiveDeck){
  assert(auditPptxAudienceCopy({deck:positiveDeck}).pass);checks.push({name:'actual neutral positive deck passes',pass:true});
  const python=process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  const mutated=path.join(out,'unplanned-shape.pptx');
  const code=`import sys,zipfile,copy
from lxml import etree as E
with zipfile.ZipFile(sys.argv[1]) as z:data={n:z.read(n) for n in z.namelist()}
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
part='ppt/slides/slide1.xml';r=E.fromstring(data[part]);s=copy.deepcopy(next(s for s in r.findall('.//p:sp',ns) if s.findall('.//a:t',ns)))
c=s.find('./p:nvSpPr/p:cNvPr',ns);c.set('id','9999');c.set('name','unplanned-audit-text')
for t in s.findall('.//a:t',ns):t.text=''
s.find('.//a:t',ns).text='原文指出过程A可能影响指标B。'
r.find('./p:cSld/p:spTree',ns).append(s);data[part]=E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True)
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:
 for n,v in data.items():z.writestr(n,v)
`;
  const r=spawnSync(python,['-c',code,path.resolve(positiveDeck),mutated],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const result=auditPptxAudienceCopy({deck:mutated});assert(!result.pass&&result.issues.some(i=>i.objectName==='unplanned-audit-text'));
  checks.push({name:'unplanned exported shape is checked independently of plan and bindings',pass:true});
}
if(report){fs.mkdirSync(path.dirname(path.resolve(report)),{recursive:true});fs.writeFileSync(report,JSON.stringify({pass:true,checks,isolatedArtifacts:out},null,2));}
console.log(JSON.stringify({pass:true,checks:checks.length}));
