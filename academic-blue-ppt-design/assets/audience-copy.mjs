/** Audience-facing copy only. Scientific uncertainty and attribution remain valid. */
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const rules=[
  ['AUDIT_LABEL',/^(?:解释边界|证据边界|共同边界|读图边界|口径对照|覆盖说明|制作说明|验收说明)(?=[:：]|$)/u],
  ['PROCESS_SOURCE_NOTE',/^(?:工程案例配图与参数沿用|(?:案例|专题)?资料口径[:：]|案例材料所述示范点结果)|未附原始监测表|待原始资料.{0,12}核验/u],
  ['SOURCE_PROCESS_NARRATION',/原文(?:指出|提到|描述|所述|写|列|未|用|把|明确指出|总体概括|的.{0,8}(?:说明|表述)|[\[（(:：])|原稿(?:写|未|指出|提到)|原图(?:未|另|补充|标签|口径|极细)|源图(?:未|Potential)|原Word|本次(?:Word|文稿|PPT)|原报告(?:量|值)|正文(?:所述|未|写|用|编号沿)/iu],
  ['EDITORIAL_INSTRUCTION',/仍以[“"']?(?:可能|可|通常)[”"']?表述|(?:可|通常)[”"']的限定保留|保留为补充|不升为第|不提升为确定结论|本页保留|左侧中文解释|不作标准定义|不视为.{0,24}普适常数/u],
  ['QA_PROCESS_NARRATION',/未额外核验|无法可靠复读|算作覆盖|计入覆盖|未读清|不猜数值|不重算|source_word_sha256|未给可靠每柱精确值/u],
];
const flat=v=>Array.isArray(v)?v.map(flat).join('\n'):v&&typeof v==='object'?(v.text!=null?flat(v.text):['runs','paragraphs'].filter(k=>k in v).map(k=>flat(v[k])).join('\n')):String(v??'');
export function inspectAudienceText(value,location={}){
  const issues=[],fullText=flat(value);
  fullText.split(/\r?\n/u).forEach((text,paragraph)=>{
    const normalized=text.normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]/gu,'');
    if(!normalized)return;
    for(const [code,pattern]of rules)if(pattern.test(normalized))issues.push({code,...location,paragraph,text,
      message:'改为直接面向听众的科学内容；制作、提取或验收记录移至工作文件。保留影响结论的条件、单位、可能性和证据强弱。'});
  });
  if(!issues.some(i=>i.code==='AUDIT_LABEL')&&rules[0][1].test(fullText.normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]/gu,'')))
    issues.push({code:'AUDIT_LABEL',...location,paragraph:0,text:fullText,message:'移出跨行的制作/验收标签；以实际科学主题命名。'});
  return issues;
}
export function auditAudienceCopy(plan){
  const issues=[];let checkedFields=0;
  for(const [pageIndex,p]of (plan.pages||[]).entries())for(const [operation,o]of (p.operations||[]).entries())for(const [slot,value]of Object.entries(o.fields||{})){
    checkedFields++;issues.push(...inspectAudienceText(value,{page:pageIndex+1,pageId:p.id,operation,operationId:o.id,slot}));
  }
  return {policyVersion:1,pass:issues.length===0,checkedFields,issues,scope:'Visible operation fields; source mappings, planning rationale, notes and QA records are excluded.'};
}
export function assertAudienceCopy(plan){
  const report=auditAudienceCopy(plan);
  if(!report.pass)throw Error('AUDIENCE_COPY_REVIEW_REQUIRED: '+JSON.stringify(report.issues));
  return report;
}
export function auditPptxAudienceCopy({deck,python,report}){
  const executable=python||process.env.PPT_PYTHON_EXECUTABLE||path.join(process.env.USERPROFILE||process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
  const inspector=fileURLToPath(new URL('../scripts/read_audience_text.py',import.meta.url));
  const r=spawnSync(executable,[inspector,path.resolve(deck)],{encoding:'utf8',maxBuffer:32*1024*1024,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  if(r.status!==0)throw Error('ACTUAL_AUDIENCE_TEXT_READ_FAILED: '+(r.stderr||r.error||r.stdout));
  const evidence=JSON.parse(r.stdout),issues=evidence.items.flatMap(item=>inspectAudienceText(item.text,{page:item.page,objectName:item.name,part:item.part}));
  const result={policyVersion:1,pass:issues.length===0,pptxSha256:crypto.createHash('sha256').update(fs.readFileSync(deck)).digest('hex'),slides:evidence.slides,checkedObjects:evidence.items.length,issues,
    scope:'Actual native slide and table text, including unplanned shapes; notes and QA are excluded. Image text still needs visual review.'};
  if(report){fs.mkdirSync(path.dirname(path.resolve(report)),{recursive:true});fs.writeFileSync(report,JSON.stringify(result,null,2));}
  return result;
}
