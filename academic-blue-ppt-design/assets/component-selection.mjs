/** Choose source-native objects from content tasks and the kind of semantic unit. */
import {findCases} from './native-components/api.mjs';
export {auditComposition,treatmentOf} from './composition-policy.mjs';

const routes={
  background:['human-left-label-band','materials-badge-panel'], definition:['human-left-label-band','materials-badge-panel'],
  'shared-risk':['human-left-label-band'], context:['human-left-label-band'],
  'key-claim':['human-gradient-statement'], 'chapter-thesis':['human-gradient-statement'],
  'integrated-route':['human-gradient-statement'], conclusion:['materials-gradient-conclusion'],
  classification:['human-square-notes','materials-hexagon-explanation'],
  conditions:['human-square-notes','materials-hexagon-explanation','human-arrow-outline-list'],
  'mechanism-notes':['materials-arrow-notes'], 'supporting-points':['materials-arrow-notes','human-dot-notes'],
  'reported-results':['human-check-notes'], criteria:['human-check-notes'],
  limitations:['human-dot-notes','materials-arrow-notes'], 'research-directions':['human-square-notes'],
  'group-heading':['materials-gradient-tab','materials-folded-tab','materials-diamond-notes'], 'group-summary':['materials-brace-group'],
  'module-heading':['materials-gradient-tab','materials-folded-tab'], 'evidence-heading':['materials-gradient-tab'],
  'mixed-region-container':['materials-mixed-region-frame'],
  'local-annotation':['materials-inset-note'],
  'region-conclusion':['materials-conclusion-strip'],
  'feedback-return':['materials-feedback-return'],
  'condition-explanation':['materials-hexagon-explanation','materials-badge-panel'],
  'definition-explanation':['human-left-label-band','materials-badge-panel'],
  'parallel-explanations':['materials-filled-column','materials-badge-panel'],
  'condition-groups':['materials-filled-column','materials-badge-panel','materials-hexagon-explanation'],
  'method-groups':['materials-badge-panel','materials-filled-column'],
  'evidence-groups':['materials-filled-column','materials-badge-panel'],
  'figure-explanation':['materials-badge-panel','materials-filled-column','materials-paper-image'],
  'quantitative-evidence':['materials-filled-column','materials-badge-panel','materials-paper-image'],
  timeline:['materials-timeline-three','materials-timeline-four'], 'four-milestones':['materials-timeline-four'], 'two-input-merge':['materials-two-input-merge'],
  'compact-keyword':['materials-dashed-keyword','materials-compact-label'], 'panel-heading':['materials-panel-heading'],
  'evidence-to-explanation':['materials-chevron-link'], 'inputs-to-mechanism':['materials-upward-link'],
  'left-to-focus':['materials-inward-right'], 'right-to-focus':['materials-inward-left'], 'shared-overview':['materials-outline-lead'],
  'ordered-steps':['materials-flow-step','materials-flow-arrow'],
  'peer-evidence':['materials-filled-column','materials-badge-panel','materials-paper-image'],
  'text-with-evidence':['materials-badge-panel','materials-filled-column','materials-paper-image'],
};
const directional=new Set(['temporal','timeline','process','flow','causal','merge','feedback']);
const listTypes=new Set(['human-arrow-outline-list','materials-arrow-notes','human-check-notes','human-square-notes','materials-diamond-notes','human-dot-notes']);
const groupTasks=new Set(['classification','conditions','criteria','reported-results','supporting-points','limitations','research-directions']);
const forbiddenTasks=new Set(['big-number','metric-spotlight','statistic-hero','kpi','numeric-spotlight']);
export function recommendComponents({task,relation,itemCount=1,evidenceStatus='unspecified',primary='text',structure='auto'}={}){
  const errors=[];
  if(!Number.isInteger(itemCount)||itemCount<1)errors.push('ITEM_COUNT_POSITIVE_INTEGER_REQUIRED');
  if(!['auto','items','groups','heading'].includes(structure))errors.push('CONTENT_STRUCTURE_NOT_SUPPORTED');
  if(forbiddenTasks.has(task))errors.push('NUMERIC_SPOTLIGHT_LAYOUT_FORBIDDEN');
  if(task==='feedback-return'&&relation!=='feedback')errors.push('FEEDBACK_RETURN_REQUIRES_FEEDBACK_RELATION');
  if(task==='reported-results'&&evidenceStatus!=='reported')errors.push('REPORTED_RESULT_REQUIRES_SOURCE_EVIDENCE');
  if(directional.has(relation)&&!['timeline','four-milestones','two-input-merge','ordered-steps','feedback-return','evidence-to-explanation','inputs-to-mechanism','left-to-focus','right-to-focus'].includes(task))errors.push('DIRECTIONAL_RELATION_NEEDS_EXPLICIT_STRUCTURE');
  if(task==='criteria'&&evidenceStatus==='proposed')errors.push('CHECK_MARK_MUST_NOT_ASSERT_PROPOSED_OUTCOME');
  if(errors.length)return {ok:false,errors,cases:[]};
  let ids=routes[task];
  if(!ids)return {ok:false,errors:['CONTENT_TASK_NOT_SUPPORTED_EXTRACT_SOURCE_COMPONENT'],cases:[]};
  if(structure==='groups'&&groupTasks.has(task))ids=['materials-filled-column','materials-badge-panel','materials-hexagon-explanation'];
  const cases=ids.map(typeId=>findCases({typeId})[0]).filter(Boolean).filter(c=>{
    if(directional.has(relation)&&listTypes.has(c.typeId))return false;
    if(c.typeId==='materials-timeline-three'&&itemCount!==3)return false;
    if(c.typeId==='materials-timeline-four'&&itemCount!==4)return false;
    if(c.typeId==='materials-two-input-merge'&&itemCount!==2)return false;
    return true;
  }).map((c,index)=>({...c,rank:index+1,selectionReason:{task,relation:relation||c.relation,itemCount,primary,structure,
    role:c.markerRole||c.visualTreatment||c.relation,
    usage:c.typeId==='materials-gradient-tab'?'Bind this heading and its explanation with a contentGroup. A lone tab does not structure body text.':
      listTypes.has(c.typeId)?'Use inside a named native panel or a bound heading group; symbols alone are not a body layout.':
      ['materials-filled-column','materials-badge-panel','materials-hexagon-explanation'].includes(c.typeId)?'Repeat once per semantic group. Same-level groups share structure, font and alignment.':
      c.typeId==='materials-paper-image'?'Bind to the claim it supports; an image does not structure unrelated loose text.':'Use for its actual content relation.',
    capacity:'Use a reviewed coordinate fixture, then measure actual PowerPoint text. Reorganize before splitting; never shrink or truncate.'}}));
  return {ok:!!cases.length,errors:cases.length?[]:['NO_SOURCE_COMPONENT_FOR_RELATION_OR_COUNT'],cases};
}

