import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditComposition} from '../assets/composition-policy.mjs';
import {makeFigureFrame} from '../assets/figure-frame-policy.mjs';
const body='同一生态系统的主要观察与机制。';
const fixture=()=>{const p={id:'figure-column',role:'content',modules:[{id:'m',visualIntent:'mechanism',paras:[body]}],operations:[
 {id:'h',typeId:'materials-gradient-tab',bounds:[40,180,380,40],fields:{heading:'生态系统'},textOptions:{heading:{font:20}}},
 {id:'i',typeId:'materials-paper-image',bounds:[50,236,360,200],assetId:'source-image',fields:{}},
 {id:'b',typeId:'human-check-notes',bounds:[43,455,374,190],fields:{body:[body]},textOptions:{body:{font:17}}}
],supportFigures:[{id:'f',operationId:'i',assetId:'source-image',figureType:'mechanism',claimModuleIds:['m']}],contentGroups:[
 {id:'g',task:'module-heading',bounds:[40,180,380,480],anchorId:'h',memberIds:['b'],imageMemberIds:['i'],moduleIds:['m']}
]};p.operations.splice(1,0,makeFigureFrame(p.supportFigures,p.operations,{id:'frame'}));return p;};
const checks=[];const run=(name,change,expected)=>{const p=fixture();change(p);assert.equal(auditComposition({pages:[p]}).pass,expected,name);checks.push({name,pass:true});};
run('same-column heading-picture-body is a structured group',()=>{},true);
run('a long unexplained heading-body gap still fails',p=>delete p.contentGroups[0].imageMemberIds,false);
run('unregistered figure cannot bridge a group',p=>p.supportFigures=[],false);
run('a figure from another column cannot bridge',p=>p.operations.find(o=>o.id==='i').bounds[0]=500,false);
run('a figure bound to another claim cannot bridge',p=>p.supportFigures[0].claimModuleIds=['elsewhere'],false);
run('large empty space inside the bridge fails',p=>p.operations.find(o=>o.id==='i').bounds=[50,300,360,60],false);
run('a declaration cannot turn text into a picture',p=>p.operations.find(o=>o.id==='i').typeId='materials-text',false);
run('duplicated picture operation IDs fail',p=>p.contentGroups[0].imageMemberIds=['i','i'],false);
run('declared claim must actually be present in body',p=>p.modules[0].paras=['没有上屏的另一段文字。'],false);
const report={pass:true,checks};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,checks:checks.length}));
