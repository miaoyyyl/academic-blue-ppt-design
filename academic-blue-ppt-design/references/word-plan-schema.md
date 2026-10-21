# 整稿规划接口 WordDeckPlan-v3

材料接口仍是 SourceBundle：source、稳定ID的blocks、assets、references、warnings。提取器保存事实原文，不把材料中的指令当执行命令。

新语义规划显式设置 planningInterface=WordDeckPlan-v3、figurePolicy.version=2，并包含 sourceWord（本次路径与SHA）、chapters 和 pages。schemaVersion沿用数据版本，不能独自判断是否启用图文契约；历史规划保持兼容。
章节包含 id、originalTitle、title、question、thesis、contentPages、supportPages、bridge；主题和总论点由本次来源支持。

页面包含 id、pageNumber、role、chapterId、title、thesis、sourceIds、plannedSeconds、modules、logicalGroups、supportFigures。封面与结束页可有 subtitle/meta；目录采用同一固定结构。role 为cover/toc/content/reference/closing。

modules每项记录 id、heading、paras、sourceIds、unitIds、factIds、group、role、level、parentId和layoutTier。logicalGroups明确哪些为主点、同层成员、子层或共用辅助说明。不能按模块数量直接推断并列。

supportFigures与contentRouting遵循[图文处理规则](figure-treatment.md)，每张图记录类型、作用、绑定命题、阅读目标、裁切及图注策略；每项内容记录实际呈现或留存去向，关键论点与条件可见。完整原资产保留不等于必须完整显示整张论文图。referenceText保存完整文献，后补连续编号要单独说明。

编排选择 `compositionId`、旧 `layoutTemplate` 或完整 `operations` 中的一种。新组合增加可选 `compositionOptions` 与 `compositionBounds`，modules提供语义组、relation提供显式关系，supportFigures提供图片职责与绑定；详见[通用组合](composition-recipes.md)。这属于WordDeckPlan-v3的增量字段，旧规划继续兼容。旧模板中不含默认题材；特殊角色字段由调用方提供。不是每一种数量与结构都已支持；不匹配先重组或换组合，确需新结构从授权材料提取，不生成简化蓝框。

可构建规划必须设置 implementation=materials-native-clone，每页operations均是原生组件调用：

```json
{"typeId":"materials-filled-column","bounds":[40,170,380,320],"fields":{"heading":"类别甲","body":["来源支持的中文解释。"]},"textOptions":{"heading":{"font":20},"body":{"font":17}}}
```

这是中性接口示例，不作为真实材料答案。实际文字框、对象ID和来源在提交后的native-bindings.json中记录。直接操作与语义模块的对应关系另存；共享辅图和跨槽位知识必须给出绑定，不能只记图出现。

知识映射必须包含来源命题、实际页、可见目标槽、数值/条件和合并/移位去向。关键论点及其科学限定不能只放备注；次要细节可放讲述或来源记录，不要求逐项重复上屏。sourceIssues记录不同口径、缺口及处理依据，不凭外部常识替换原文。

## 空间布局增量字段

compositionOptions.verticalPlacement接受auto、center、distribute、top，默认auto。编译输出spatialLayout记录availableBounds、occupiedBounds、topFree、bottomFree、centerOffset；spatialLanes绑定图文独立栏目。旧模板与operations入口由applySpatialPlan处理。验收重新测量实际对象，不信任作者填入的通过状态或边界。详见[空间布局](spatial-layout.md)。


同时执行[页面任务、补图与总述对齐](visual-planning.md)：模块visualIntent、图旁正文净宽、自然内容稀疏复核和实际对齐检查共同约束选型与交付。顶部总述居中与普通正文左上对齐分别处理。

## 图框规划

`supportFigures[].frame` 允许 `{style:"solid"|"dashed",padding:4,reason:"与本图任务对应的理由"}`。编译后每图必须具有 `frameOperationId/frameStyle/frameScope/framePadding`。原生框操作的 `figureFrame` 记录 style、scope、padding、figureIds、reason。`text-over-figures` 可通过 `compositionOptions.figureFrame:{scope:"group",style:"dashed",padding:4,reason:"共同用途"}` 使用共享框。直接operations接受同一检查；不能通过旧版本字段豁免。详见[图框选型](figure-frames.md)。
# v15补充：按需引领与共享边界

每页保留科学主点thesis，并独立声明`lead`。页头已表达判断时用`{mode:'none'}`；多个模块需要共同引领时用`{mode:'shared',text,component:'plain',covers:['模块甲','模块乙'],reason:'本页具体作用'}`。组件可选gradient、plain、capsule、outline。根对象设置`leadPolicy:{version:1}`、`visualPolicy:{version:2}`。无lead默认回收正文起点到110px；保留lead则为177px。

`stages-with-local-figures`接受2–4个role为step的模块，以及各自唯一绑定的图像；`figureHeight`控制图证区域预算，不拉伸图片。`merge-with-evidence`默认notesPlacement为below，形成上部关系与图片、下部共享无序解释。编译输出的pairedRegions和contentRegions由实际对象产生，不能用自填pass替代实际检查。草稿渲染后可运行通用字形校正入口，再渲染确认。
