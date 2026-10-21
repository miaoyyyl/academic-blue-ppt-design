# 本机运行与重建

新规划可使用`compositionId`、`compositionOptions`及可选`compositionBounds`，经`plan_native_layout.mjs`编译。规格与中性调用见[通用图文组合](composition-recipes.md)。旧layoutTemplate和完整operations仍可用，但单个输入页不能同时选择多种方式。

`node scripts/test_composition_layout.mjs 检查.json`验证组合的关系、数量、容量、图片裁切与绑定；`node scripts/make_composition_examples.mjs 测试目录`生成16类×标准/容量/可选变化的48页中性规划与像素测试资产。用其deck-plan.json和input/asset-manifest.json调用build_native_deck，再用PowerPoint实际渲染。中性资产不作为科研插图。新关系与整稿结构检查见[关系布局](relationship-layouts.md)。

先用 load_workspace_dependencies 定位当前 bundled Node、Python 与 @oai/artifact-tool。核心桥需要Python的lxml，图片需要Pillow；Windows实际渲染需要PowerPoint。可通过PPT_ARTIFACT_MODULE_DIR和PPT_PYTHON_EXECUTABLE指定本机依赖，不调用外部模型API。

```text
python scripts/extract_word.py 输入.docx 提取目录
node scripts/query_components.mjs --relation parallel --count 3
node scripts/plan_native_layout.mjs 已审核语义规划.json 原生规划.json
node scripts/build_deck.mjs 原生规划.json 提取目录/source-bundle.json 提取目录/asset-manifest.json 制作目录
node scripts/finalize_deck.mjs 原生规划.json 制作目录/presentation.pptx 新定稿目录
python scripts/verify_native_deck.py 新定稿目录/presentation.pptx 制作目录/native-bindings.json 核对.json
```

`build_deck`为真实Word入口，核对Word实际SHA、来源ID与清单一致。`build_native_deck`为内部原生提交入口，也供中性组件测试使用。默认入口拒绝旧版简化几何规划。bank的原PPT来源名仅作溯源，运行无需原materials目录。

实际导出：`render_check.ps1 -DeckPath 新稿.pptx -OutputDir 检查目录`。脚本记录对象旋转后的实际边界、文字所需高度、自动缩字、PDF与PNG。按度量重排后重新导出，不能自动缩字。中文行检查：`inspect_native_lines.ps1 -DeckPath 新稿.pptx -ReportPath 实际行.json`。

编辑保存重开：`verify_editability.ps1 -DeckPath 新稿.pptx -OutputDir 编辑检查目录`。只改工作副本，检查实际存在的对象；没有的表格/图表记不适用。所有PowerPoint COM检查串行执行，不关闭用户已打开的演示文稿。

中性组件测试在skill副本中运行，生成器会将样例写回examples；图框绑定另由test_figure_frames.mjs及实际PPTX检查覆盖，独立几何样例不能代替内容页验收。中性组件测试：`make_native_examples.py 测试目录`按registry生成各类×3场景（按当前registry数量生成）；用其native-plan和input/asset-manifest运行build_native_deck，再渲染检查。已审核坐标的组件从包内示例读取，保留嵌套坐标并写入目标pt字号。失败输入见test_native_contract.mjs；内容路由和主体重复检查见test_component_selection.mjs。

`plan_native_layout.mjs`支持 `timeline-three-events`、`compact-enumerated-list`、`two-input-conditions` 三种紧凑关系布局。一般面板按正文需要计算高度，超容量失败；章节号由章节和subsectionId推导，不读取物理页码。已有operation规划用 `prepare_narrative_plan.mjs 输入 输出` 生成副本后检查，正文实际高度仍须作者按内容调整并实渲染。

目录与章节切换页由`navigation-layout.mjs`统一为五个概括章名：删除额外介绍及底框，固定行高72px、行间净距32px，条目组垂直居中，编号和章名各自水平及垂直居中。当前章节的边框、分隔线和文字一起高亮。`test_navigation_layout.mjs`检查旧说明槽位、错误章节数量及附加介绍被拒绝；本组件要求五部分，其他数量应选择有来源的对应结构。

`verify_rendered_text.py 规划.json native-bindings.json powerpoint-check.json 报告.json` 对照PowerPoint实际字号与规划字号，覆盖嵌套组，并要求新增逻辑节点至少17pt、文字适配且未启用自动缩字。源码结构核对、实际字体检查和逐页视觉核对分别完成。

`audit_composition.mjs 原生规划.json 报告.json`按实际主体操作检查整稿重复；`audit_composition.mjs --select 选型请求.json`按内容任务查来源对象。新版Word构建入口保存composition-audit.json，componentSelectionVersion为4时要求消除未解释的重复警报。`verify_native_text_styles.py 成品.pptx 规划.json native-bindings.json 报告.json`核对原生符号、字体、悬挂缩进及可编辑强调文本，弥补形状保真检查不比较正文样式的范围限制。

`verify_component_edits.ps1 -CasesPath 编辑案例.json -OutputDir 验证目录` 在副本中定位指定原生对象，包含组合子对象，并测试编辑/移动、保存和重开。案例JSON是数组，每项含`id`、`deck`和`cases`；每个case含`page`、`name`、`kind`（text/image/connector/shape）与`typeId`。shape只接受原生形状、自由形状或组合；括号不能冒充连接线检查。对象名来自实际native-bindings或源对象绑定，不按视觉位置猜测。原成品不改。

分发：`validate_distribution.py skill目录 报告.json`检查中性闭合与接口。重建：`package_rebuild.py 原生规划.json source-bundle.json asset-manifest.json 新空目录`冻结本次Word、资产、规划和skill，生成rebuild.ps1。整体搬移后运行可重建，科学内容只在材料包，不能作为skill默认输入。

官方定稿器验证实际尺寸、字体和SDK回读，receipt记录要求与结果；这不代替事实与视觉。图表与表格未在本次Word提供原生数据，不虚构存在或已验证。

支持普通段落、手写标题、内嵌图、图注与图文包装表。复杂公式、浮动Word对象和外链资源需另行测试。推断文献尾段已覆盖本次手写编号/未编号混排，不能宣称适用于所有Word排版。

## 空间布局检查

编译器默认对内容组做二次定位；新输出带spatialPolicy.version=1。实际导出需传规划及本次绑定：`render_check.ps1 -DeckPath 新稿.pptx -OutputDir 检查目录 -PlanPath deck-plan.json -BindingsPath native-bindings.json`。该调用生成rendered-spatial.json；build/finalize内的组合审查也包含spatial。`test_spatial_layout.mjs`检查通用组合，`test_spatial_pptx.mjs PPTX 规划 绑定 报告`检查实际对象移回顶部后会被拒绝。详见[空间布局](spatial-layout.md)。
