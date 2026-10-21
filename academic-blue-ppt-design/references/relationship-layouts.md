# 关系组合、原生证据与整稿节奏

先读每页要回答的问题，标明关系，再选择可调用结构。段落数、图片数或栏目数不能代替关系判断。

## 三层检索与选择

- 原生件：登记源文件SHA、物理页、对象ID、槽位、正常字号容量与失败条件。
- 关系区：编号、分类、汇合、括号展开、时间、循环、比较矩阵和问题—措施映射。
- 页面：关系区与证据区按容量组合，图像不再全局排除关系结构。照片按应用或场景用途绑定，数据图按证据绑定。

`recommendCompositions(request)` 返回可容纳候选、源组件及`structure`，`distinctCandidates` 合并只有容器样式不同的相近骨架。`preferredCompositionId` 不加分。`chooseComposition(request)` 默认执行最高匹配候选；考虑关系、任务、图片作用和本稿已用组合。它不制造内容关系。

规划页使用 `compositionId:'auto'`、显式`relation`、`pageTask`和本页`selectionContext`。需要人工选定时使用：

```javascript
compositionSelection:{
 mode:'reviewed',
 compositionId:'figure-with-explanations',
 reason:'本页主证据需要保留完整横轴与误差范围，旁列解释口径，避免在下部窄图带中压缩读图区域。'
}
```

覆盖必须属于通过容量与语义预检的候选；理由不能解除禁止缩字、无关图片或关系错误等约束。

## 新组合接口

| compositionId | relation | 模块数/图片数 | 必要信息 |
|---|---|---|---|
| timeline-with-evidence | temporal | 3 / 1–3 | 模块`date`；`relationEvidence`包含时间依据来源 |
| numbered-with-evidence | unordered、parallel、classification | 2–4 / 1–2 | 编号只作定位，不表示先后或等级 |
| classified-with-evidence | classification、parallel | 2–3 / 1 | 适合短分类标签；正常字号下正文须有足够净宽 |
| merge-with-evidence | merge、collaboration | 3 / 1–2 | 两个`role:input`、一个`role:result`及汇合依据 |
| branch-with-evidence | total-detail、collaboration、conditions | 3–4 / 1–2 | 一个`role:core`，其余为`detail`；括号表示归属 |
| cycle-with-evidence | cycle | 3 / 1 | 三条有来源的闭合边，原文确有回流 |
| matrix-with-evidence | comparison、matrix | 5 / 1–2 | 五个共同表头，每模块标题加4段作为一条记录 |
| response-with-evidence | problem-response | 2 / 1–2 | 每模块标题为问题类别，两段分别为表现和措施 |
| stages-with-local-figures | process、flow、temporal | 2–4 / 与模块等数 | 各模块role为step，逐项绑定独立图片；解释与图片构成完整栏目 |

`compositionOptions.relationEvidence:{kind,sourceIds,edges?}` 记录方向依据。循环`edges`由模块ID构成，每个节点必须恰有一入一出，禁止自环和未闭合路径。日期不可凭空补入。分类、职责和条件不能自动转成因果。

原有同层解释、左标签行、背景要点也接受证据区域；不足容量时会拒绝，不通过缩字或拉伸挤入。窄图旁正文不足340px的左标签仍拒绝。

`merge-with-evidence`默认`notesPlacement:'below'`：上部双输入汇合与图片共用起点和高度，下部用一个原生无序列表共同承载解释，避免两栏短句及单独附注散排。`bullet`可为原生圆点、方框或适合其语义的勾选；普通说明不自动加粗。`notesPlacement:'split'`保留旧分栏入口，但仍须通过局部内容检查。每一步有独立对象/设备图时优先比较`stages-with-local-figures`，不把一张共享图复制到多步。

## 原生表格

`human-comparison-table`为6×5，`human-response-table`为3×3，克隆人工稿的表头和数据单元格样式，并在认证范围内重复行。每格都是PowerPoint原生可编辑单元格。槽位`cellR_C`绑定原表对象的`.cell.R.C`，来源、逐格文字、字号、对齐和实际适配均检查。

`tableColumnWeights`、`tableRowWeights`只调整既有网格的宽高，不能更改已认证行列数。正文正常字号17pt，表头18pt；比较数据保留单位、时间、统计范围，存量与流量不得相加。表格没有证据时不能靠排入网格制造可比性。

## 整稿检查

`auditLayoutDiversity`依据原生对象和实际图像区域记录结构；忽略颜色、组合名称、公共页头、图注与图框，左右镜像归入共同骨架。结合实际正文权重检查相似标题面板合计占比、章节集中和连续相似拓扑。

当前阈值是复核触发条件：8页以上正文中相似标题容器超过65%；同骨架超过50%；4页以上的章节中相似标题容器达到80%；连续3页相似骨架。它们不是要求每稿凑够几类，后续应按实际参考与用户反馈校准。

同一证据系列可记录共同来源、页面范围与具体比较目的，保留可比槽位；普通“为了统一”等泛化理由不能豁免。结构检查通过后仍需查看全稿缩略图和实际单页。

## 验证

`test_relationship_compositions.mjs`覆盖带图兼容、方向依据、闭环与偏好自证；`test_layout_diversity.mjs`使用中性案例验证换色/换名不能逃避重复。`make_composition_examples.mjs`生成16类×3场景的中性请求；只用于结构和容量验证，图像不作为科学插图。

新增结构先看源页与原生XML，再生成标准、容量和可选样例，实际渲染后检查。通用包不包含用户文稿、科研案例默认输入或机器绝对路径。

方法参考：[Presenton template-v2](https://github.com/presenton/presenton/blob/main/docs/template-v2.md)的槽位与容量认证，以及[PPTAgent](https://github.com/icip-cas/PPTAgent)的参考分析、生成和视觉评估分离；不依赖其模型服务或替换现有原生桥。
