# 区域图文编排与输入隔离

先完成论证和阅读任务，再选择区域拓扑。图片可以较小，前提是相应对象可辨、关键数据及图例可读；必要的文字解释使用原生文本。不能按图片张数决定关系，也不能为了轮换样式制造流程。

## 接口与职责

WordDeckPlan-v4 页面可在 compositionId 同时声明 regions，编译接口为 `compileComposition({compositionId, groups, figures, regions, edges, ...})`。原有17类组合继续保留；6类区域组合及[四种复合结构](reference-page-structures.md)共同参与推荐。声明regions而选择旧整页组合会被拒绝，不能静默丢弃结构。

| compositionId | 区域任务 |
|---|---|
| mixed-evidence-regions | 多个完整图文区域，共同支撑判断 |
| method-and-stacked-results | 纵向方法区域与上下分层结果 |
| principle-and-method-regions | 原理、方法及局部说明 |
| images-definitions-local-flow | 图组、编号解释和局部流程同页 |
| multipart-figure-callouts | 复合图与绑定子区域的定位解释 |
| idea-and-route-lanes | 整体思路与技术路线分层表达 |

regions 是相对于父区的0—1矩形。每项含 `id,purpose,heading,rect,kind,moduleIds,figureIds`，可含 `children,headingStyle,layout,sideLabel`。每区须有明确用途及有效内容，允许一层外框加一层局部证据/说明。父区和局部区域的ID不能重复，不允许循环。

kind支持evidence、notes、numbered、flow、merge、callouts、table及有children的父区域。layout支持正文在图上方、image-top、figure-left、figure-right。所有图文、流程和表格均使用包内授权原生组件，不画替代几何。

同一区域可包含多幅图，各图仍保留claimModuleIds、figureType、figureRole和readingTargets。minimumDisplay限定完整显示大小；需要阅读的子区域可以设置minimumWidthPx。复合图局部解释需在模块的targetNames绑定原图readingTargets.name。原图完整保留，裁切可恢复。

flow中的moduleIds明确步骤次序，需有本次文稿sourceIds依据。merge明确两个输入和一个结果，不能将并列对象强作汇合。feedback注明fromId、toId及sourceIds；只有材料支持的反馈才能绘制返回线。原生返回线可水平镜像，不能仅凭空间顺序编造关系。

table复用原生5列表格：5个模块，每项heading作为首列、4个paras作为其余列，tableHeaders含5项。容量依据实际列宽、正常字号和行高检查。

notes和流程框根据自然内容收高；完整、不相交的区域行可在布局后紧凑排列。高栏旁的上下区域保留各自对齐线。外框面积、空框和大行距不能计作有效内容；无图且自然内容不足的局部区域仍触发合并或补图复核。

## 图框与实际检查

图片框只包图片；图组框只包共同图证；图文区域框包含关联标题、正文、图片和注释。合法区域框可承担成员图片的边界，无须为每图重复套框。图注应在本区域内与图片绑定。

编译输出contentRegions、relationEdges、contentRouting及成员绑定。推荐、编译、直接操作、实际PPTX和定稿使用auditRegions同一契约，核对原生框线、成员位置、图证职责、阅读尺寸、注释对子图的绑定和有依据的连线。结构指纹包括父子区域、图文位置及关系，不用组件名或颜色代替拓扑。

原生组件内的嵌套文字槽位使用页面坐标；OOXML桥会转换为父组合坐标，避免二次缩放和偏移。实际渲染与保存重开依旧必需。

## 中性回归

`node scripts/test_region_compositions.mjs 输出目录`生成六类中性区域规划并检查同区多图、嵌套说明、定位解读、双层路线、孤立成员、空框、错误连线和阅读尺寸失败。输入素材是独立中性像素测试图，不能作为科学插图。

`compositionExample`和组合/空间回归覆盖全部27类。make_composition_examples生成器须保留regions、contentRegions、relationEdges和referenceEdges。单组件、组合、实际PPTX及真实文稿分别验收。

## 用户要求隔离时

先复制当前Word和不含科学默认内容的skill到新的独立目录。旧成品、旧规划、旧项目科学资产与同名人工答案PPT不能进入输入。组件原始PPT文件名仅为溯源元数据，不构成运行时读取。

制作进程可设置PPT_ISOLATION_ROOT为新目录，PPT_EXCLUDED_PROJECT_ROOT为原项目根目录；Node以 `--import ./skill/assets/isolated-io.mjs` 启动，Python子进程的PYTHONPATH指向 `skill/assets/isolated-python`。路径守卫拒绝读取原项目中的其他目录并记录访问日志。这是制作进程的输入路径约束，不等同操作系统级沙箱；应另核对实际输入、图片哈希及成品来源。

正式版保护哈希、隔离清单、输入读取日志和搬移重建结果放在制作包，不进入PPT展示页。正式安装须等待用户验收。
