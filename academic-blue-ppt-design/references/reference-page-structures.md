# 四种复合页面结构

此处是通用组织方法，不是新的默认四页模板。按任务、模块角色、图证职责和正常字号下的容量检索，不能用图的数量推断关系。来源文件仅用于溯源，运行不读取原始材料目录。

## 选型

| 页面任务task | compositionId | 组织与适用情形 |
|---|---|---|
| theory-to-application | theory-mechanism-application | 左栏三条理论短点与小图；中栏机理图、两类输入及向上的共同关联；右栏应用解释与图证。理论、对象、机理和应用各有职责 |
| perspectives-and-milestones | perspectives-timeline-evidence | 上部四个说明卡，中部四节点细线时间轴，下部两个带竖侧标签的图证区。说明维度和时间阶段是两条独立信息层，不把上下位置当成因果 |
| findings-with-focus | evidence-rows-and-focus | 左侧二至四行“小图—说明连接件—解释”，右侧一幅带侧标签的综合图证。连接件只标记图文对应，图不必占大半页 |
| questions-and-research | questions-focus-evidence-strip | 两侧分别组织已有认识与拟开展问题，中间解释研究内容，两侧箭头都指向中央；底部四幅独立图证。箭头表达问题与内容的关联，不表达先后或成功转化 |

九类新部件：materials-timeline-four、materials-dashed-keyword、materials-compact-label、materials-panel-heading、materials-chevron-link、materials-upward-link、materials-inward-right、materials-inward-left、materials-outline-lead。侧标签、图框、区域框和普通图文说明继续复用已有组件。

## 规划接口

使用现有`chooseComposition`与`compileComposition`。groups中的role分别为：

- 理论与机理：theory三条、input两条、mechanism一条、application一条；三幅图分别绑定理论组、机理和应用。
- 说明卡与阶段：perspective四条、milestone四条、evidence两条；milestone必须有date，图绑定各自evidence模块。
- 逐行发现：finding二至四条、core一条；每条finding一图，综合图绑定core。
- 双侧问题：established二至四条、focus一至两条、planned二至四条；四幅图分别绑定其支持的模块。

所有模块保留id、heading、paras、sourceIds和visualIntent；所有图保留assetId、尺寸、claimModuleIds、figureType、figureRole、readingTargets。短标签使用label槽位，水平和垂直居中；长段解释仍左上对齐。角色不合或文字超容量就换组合，不为套用版式篡改内容。

时间轴、输入指向机理、两侧关联研究内容，须在`compositionOptions.relationEvidence.sourceIds`记录当前文稿依据。逐行连接件使用该发现自身的sourceIds，表示图文对应。箭头源对象、目标对象、方向与原生部件在referenceEdges绑定，实际导出后再次核对。四节点时间轴保留四个圆点，不能只改日期字符串假装第四节点。

默认无额外总述，收回顶部空间。确需共同引领多个区域时使用现有lead机制；`component:'native-outline'`可选白底细框句。句子居中、末尾无句读标点；不把参考截图中的每页综述习惯变为强制项。

`referenceExample`提供不含科研结论的调用示例；调用者提供本次登记图片。`test_reference_layouts.mjs 输出目录`检验推荐、编译、角色、容量、图文映射、方向和缺失节点；原生例分别包含standard/capacity/optional场景。测试图及验收记录留在制作包。

## 来源与视觉边界

四种结构分别参考授权材料`4白蓝色系-国家自然科学项目申请答辩结题汇报PPT.pptx`第9、8、10、14页。每个新部件JSON记录页、对象ID、文件哈希与原生XML，清空科学文字，未打包原稿科学图片。提取时仅将源主题色解析为相同RGB，保留形状、线型、渐变、旋转与组合层次。

组合迁移组织方法；蓝白页头沿用当前风格。图片依其阅读职责设定大小，复杂坐标图或细节不足时合并图组、替换组合或拆页，不缩字、拉伸图像或添加无关素材。表格白底、折角外贴和内容页无制作脚注等已有规则继续生效。
