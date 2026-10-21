# 从人工稿提炼图文组合

组合是有内容关系和可调区域的一组原生组件，不是整页截图，也不是某个科研主题的答案。结构来源包括已审核人工稿与 materials；运行时只读取本包的中性规格和原生对象。

## 内容、组合和空间的决策顺序

先写一句可见主点，再区分共同层级、从属解释和共享证据。对每张图分别确定类型、作用、绑定命题和需要看清的内容，然后才给区域。

| 观察到的组织方法 | 通用判断 | 不适用情形 |
| --- | --- | --- |
| 同层栏目反复使用同样的标题、图、正文顺序 | 每个对象有独立配图时用同层图文栏，共用槽位和基线 | 没有独立配图时不重复同一张图充数 |
| 中文论述在上，多幅图共同补充 | 正文先按容量收高，剩余区域作为共享图组 | 不把复杂图压到极矮区域，只满足“有图” |
| 完整器官、植物或反应图旁放分组短解释 | 主图保留整体，旁列只说明本页关键判断 | 不把所有英文节点逐项翻译为长段正文 |
| 多个类别使用共同左标签行 | 用同宽行比较短解释，比不同尺寸卡片更紧凑 | 标签过长或正文过密时换结构，不缩字 |
| 过程和条件分区 | 明确步骤用原生节点与方向，条件/结果另归组 | 同层类别不能因为数量合适而加箭头 |
| 大图与次要图尺寸不同 | 以实际作用和阅读目标分配大小 | 不把大面积自动当作核心证据 |

图片类型与作用分别判断：数据图保留相关坐标、单位和图例；机理图保留关键节点和路径；现象图保留主体。背景、Logo、证书和人物装饰不计作科学图。没有必要配图时用真实分类、比较或关系结构组织内容。

文字主导表示论述由可见主点与关键分项承担，不要求文字面积大于图片。内容去向记录到正文、图片、讲述或来源。关键条件与结论不能只放备注；图注不承担长篇读图分析。

## 当前可调用组合

| compositionId | 槽位和数量 | 适用与可调区域 |
| --- | --- | --- |
| peer-text-panels | 1–4组标题与解释，无图 | 同层解释/比较；tab、filled或badge，正文按容量收高并平衡整组位置 |
| peer-figure-columns | 2–4组，各有独立图片 | 共同图文顺序；支持标题—图—正文或标题—正文—图 |
| text-over-figures | 1–4论述组、1–4共享图 | 上部正文、下部图组；图宽按裁后形状或显式权重分配 |
| figure-with-explanations | 1主图、1–4解释组 | 图在左/右，解释可用左标签、专题标题或面板；文字列宽可调 |
| labeled-rows | 1–6个同层短解释 | 左标签宽度、共同列宽/行高与行距；按最大正文需要收高，并适度分配行距及上下留白 |
| context-and-notes | 1背景、1要点组 | 上部定位与下部有标题的原生符号说明 |
| process-with-evidence | 2–4明确步骤，可加1条件/结果说明，0–2图 | 图在下方，或单幅竖图在右侧；过程宽度可调 |
| evidence-and-details | 1核心组、1–3补充组、1–3图 | 核心列含论述与图，旁列分层补充；主辅宽度可调 |

这些数量是当前各组合已验证的范围，不是整个组件库的类型上限。题材、换色和同一结构的字号变化不增加逻辑类型。遇到不同结构先检查已有组合能否重组；确需新增时从授权原生对象派生，并完成标准、容量、可选变化与失败输入验证。

## 接口

`assets/composition-layout.mjs` 导出：

```js
recommendCompositions(pageSpec)
// {ok, candidates, incompatible, errors}
// candidates包含compositionId、rank、reason、constraints、use和avoid。

compileComposition({
  compositionId, pageId, bounds, groups, figures, relation, options, assets
})
// 成功：{ok:true, operations, contentGroups, supportFigures,
//        contentRouting, bindings, usedBounds, recipe}
// 不适配：{ok:false, operations:[], errors, suggestions}
```

`groups`沿用页面modules，至少给id、heading、paras和sourceIds。推荐输入中的`modules/supportFigures`亦兼容。明确过程用`role:'step'`，可选说明用`role:'condition'|'annotation'`；核心证据用`role:'core'`和`role:'detail'`。不能由模块数量代替这些判断。

`relation`为显式关系。并列组合接受parallel/comparison/classification；主图解释可接受total-detail/causal；过程组合只接受process/causal/flow/temporal。调用者依据文稿选关系，不把因果与过程当同义词。

`figures`沿用WordDeckPlan-v3的supportFigures：图的类型、作用、claimModuleIds、readingTargets、captionPolicy、sourceKind；增加或透传dimensions、imageCrop、imageAlign及可选短caption。资产尺寸以本次清单为准；传入非空资产清单时未知资产立即失败。

`bounds`默认`[44,177,1192,480]`，仅为页头和页脚之间的区域。`options`按组合提供`treatment`、`gap`、`labelWidth`、`textWidth`、`figurePosition`、`figureWeights`、`order`、`processWidth`或`coreWidth`。它们调整既有原生对象的区域；不改变文字的原定字号。

选型顺序为关系和槽位匹配、绑定检查、容量与形状预检。推荐只给候选与原因，不因排名免除实际渲染。可显式选择另一个适配候选，并记录内容理由。

## 中性调用示例

```js
import {recommendCompositions,compileComposition} from './assets/composition-layout.mjs';
const request={
  pageId:'comparison', relation:'comparison',
  groups:[
    {id:'a',heading:'类别甲',paras:['条件：说明作用及适用范围。'],sourceIds:['p-1']},
    {id:'b',heading:'类别乙',paras:['条件：保留比较口径与差异。'],sourceIds:['p-2']}
  ],figures:[]
};
const candidates=recommendCompositions(request);
const compiled=compileComposition({...request,compositionId:'peer-text-panels',options:{treatment:'tab'}});
```

真实文稿由Codex提供内容与关系。`assets/composition-examples.mjs`和`make_composition_examples.mjs 输出目录`提供各类标准、接近容量与可选变化，不带科研默认输入。中性像素资产只验证形状、裁切和绑定，不能作为科研配图。

## 接入和检查

页面填写compositionId、compositionOptions和可选compositionBounds，使用`plan_native_layout.mjs`编译；输出旁保存`.composition-selection.json`和`.composition-audit.json`。同一输入页只选择compositionId、layoutTemplate或非空operations中的一种；编译后的operations是制作产物。

图注为none时完全不预留图注区；短图注按实际需要留高，不继承旧模板的大块captionH。图片按裁切后的比例等比显示，保留原资产与原生可恢复裁切。输出同时保存请求区域、预计显示区域、最终对象绑定；预计几何不等于视觉通过。

不适配返回明确错误与需要的高度、可用高度或错绑对象。先重组文字和图组，再换组合，确实超容量才拆页。不自动缩字或截断，也不更换成未授权简化绘图。

检查计划和实际PPTX的正文结构、图文绑定与字号。逐页看PowerPoint渲染，尤其复核数据坐标、机理路径、现象主体，以及复杂图的有效大小。同一输入只增加操作声明不能豁免检查。

方法参考：[Presenton Template V2](https://github.com/presenton/presenton/blob/main/docs/template-v2.md)的槽位、可变区域与容量分层；[PPTAgent](https://github.com/icip-cas/PPTAgent/tree/v0.2.0)的分析与生成分离。沿用本地实现，不接入这些项目的服务。

## 内容组位置

所有组合先测量自然边界，再按[空间布局](spatial-layout.md)执行第二阶段定位。compositionOptions.verticalPlacement默认auto，也支持center、distribute、top；文字框内仍靠上。top不豁免实际空间检查。usedBounds保留旧的可用区含义，实际占用使用occupiedBounds。


同时执行[页面任务、补图与总述对齐](visual-planning.md)：模块visualIntent、图旁正文净宽、自然内容稀疏复核和实际对齐检查共同约束选型与交付。顶部总述居中与普通正文左上对齐分别处理。

## 图框与图组

图片默认带匹配的原生框。独立设备/现场/数据用实线；辅助示意可用虚线；共享图组在记录共同用途后使用一个外框，取消各图重复框。优先沿用人工稿的图文归属和同层一致性，参见[图框选型](figure-frames.md)。

当前提供16类组合，新增8类见[关系组合与整稿节奏](relationship-layouts.md)。原同层解释、左标签行和背景要点支持可选证据区域，图片数量不再与这些结构互斥。
