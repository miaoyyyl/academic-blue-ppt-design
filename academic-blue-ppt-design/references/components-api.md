# 已授权参考稿的原生组件接口

整页优先使用[图文组合接口](composition-recipes.md)：`recommendCompositions`先匹配关系、槽位与容量，`compileComposition`将可调用组合编译成下述基础组件操作。`recommendComponents`、`findCases`和`renderComponent`接口保持不变。

唯一活动目录为 `assets/native-components`。旧简化几何已移出分发包。每个类型包含原文件相对名与SHA256、原页、对象ID、完整原生XML、原图依赖、槽位和不可回退标记。运行时读取包内中性原型，不需要打开原材料。

```javascript
import {findCases,renderComponent} from './assets/native-components/api.mjs';
const cases=findCases({relation:'parallel',itemCount:3});
slide.nativeOperations=[];
const result=await renderComponent({
 typeId:'materials-filled-column', slide,
 bounds:[40,170,380,320],
 content:{fields:{heading:'类别甲',body:['依据：本次材料的实际中文解释。']},
   textOptions:{heading:{font:20},body:{font:17}}},assets:{}
});
```

一个栏目可重复三次组成三类同层内容；同层数量属于语义规划，不是从物理形状数推断。`findCases` 支持 typeId、relation、role、itemCount、sourcePage、contentTask、visualTreatment、markerRole。来源字段用于追溯结构，禁止当作科研内容检索。按内容推荐及整稿审查见 [选型说明](component-selection.md)。

`bounds`为1280×720坐标中的 `[x,y,width,height]`。`fields`只接受原型已有槽位；图片使用本次资产清单的 `assetId`，禁止任意路径。`textOptions`可指定字体大小、粗体、颜色、对齐和实际文字框；`objectBoxes`只调整现有原生对象的位置尺寸，不生成新几何。目录激活样式复制自同一原例的激活/未激活样式。

`materials-text`仅用于已有结构内的从属文字、绑定标题组的解释、封面文字和参考文献，不能直接拼成正文布局。独立圆角标题通过页面`contentGroups`绑定操作`id`，详见[内容选型与强制检查](component-selection.md)。`recommendComponents`接受`structure:'groups'|'items'|'heading'|'auto'`区分解释组、短条目和标题；`findCases`支持`contentStructure`检索。

`renderComponent`先登记原生操作，返回来源与槽位绑定，`pendingCommit=true`。`build_native_deck.mjs`经 Artifact Tool 生成页面/备注，再由原生桥提交实际对象；`native-bindings.json`记录最终对象ID和名称，不能把待提交对象宣称为已完成。

标准构建、直接原生构建和定稿入口均执行正文结构及数值字号检查；导出后使用实际绑定文字、run字号和递归组合几何复查。单个组件接口通过只表示槽位有效，不能代替整页合格；不允许以直接调用接口绕过整页检查。

未知类型、未知槽位、越界、缺图或非登记资产明确失败，不落入画框后备。文本容量必须再过 PowerPoint 实际渲染，不能以启发式字数作为保证。超容量返回具体文字框和所需高度，保持原定字号后重新组织。

当前34个类型与变体，以registry为准，含原生循环、表格、关系组件与图框。五类项目符号分别是视觉/语义变体，不能计作五种新的关系结构，更不能把组件数量宣称为完整页面数量。

`imageCrop:[left,top,right,bottom]` 支持四边0–1移除比例，保持剩余区域的比例，以原生a:srcRect实现可恢复裁切；原始媒体保留。绑定另保存源资产SHA、像素尺寸、裁切及实际显示位置，详见[图文处理规则](figure-treatment.md)。

`imageAlign` 支持 `center`、`left-top`、`right-top`，仅改变所选区域等比显示时的留白方向。正文布局和章节编号必须遵守 [content-placement.md](content-placement.md)。嵌套槽保留局部坐标，不把绝对页面坐标传给子形状。

`textOptions.vAlign` 默认为`t`（框内靠上），圆形编号等短标记可显式用`ctr`；正文不因此改为垂直居中。PowerPoint检查递归检查组合中的文字；嵌套框不能只凭外层边界判断适配。

`materials-navigation`只接受五个`item0…item4`和对应编号，不提供`thesis`介绍槽。用`createNavigationOperation({items,activeIndex})`生成，或`applyNavigationPolicy(plan)`整理现有规划。渲染入口统一按等间距、整体居中与文字居中定位，保留原生激活样式；只支持完整1280×720画布。原例192/194号介绍底框和文字框已从此原型移除，不以空文字框保留。

原生列表默认 `bullet:'source'`，保留源 `buChar`、`buFont`、`marL` 和 `indent`。只允许 `source` 或 `none`；没有原生模板的组件拒绝启用source。空段落不保留符号。`paragraphAfter` 是段后pt，允许0–72。`emphasis:[{text:'本次正文中的词',color:'C00000',bold:true}]`生成可编辑富文本，词必须实际存在；不能通过强调字段插入正文没有的结论。每段正文仍以原字符串核对。

例如 `human-square-notes` 的body可用 `textOptions:{body:{font:18,bullet:'source',paragraphAfter:10,emphasis:[{text:'边界',color:'C00000'}]}}`。不能将源Wingdings的字形码直接作为可见文字拼接，不能改变原字符后仍声称原生符号保真。

## 整组位置与框内文字

textOptions.vAlign只控制框内文字；compositionOptions.verticalPlacement控制整组位置，两者独立。布局平移同步operations、绝对文字框、objectBoxes、组边界、图片图注及绑定；嵌套局部坐标和归一化裁切不平移。详见[空间布局](spatial-layout.md)。

## 图片与框组件

新增 `human-figure-frame-solid`（人工微塑料第20页对象22）与 `materials-figure-frame-dashed`（白蓝模板第3页对象52），slots为空，按实际图像显示范围定位，不能作正文承载组件。推荐、compileFigure及compileComposition均支持原生图框，详见[图框选型](figure-frames.md)。

关系组合、原生表格与整稿结构检查见[关系布局](relationship-layouts.md)。
