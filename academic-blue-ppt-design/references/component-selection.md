# 内容任务、原生组件与整稿搭配

先确定主张、同层组别、从属解释和图片职责，每个解释单元都参与选型。不能只给项目符号调用推荐，其他部分直接输出普通文字。

先按[通用图文组合](composition-recipes.md)选择整页或关系区域的槽位结构，调用`recommendCompositions`预检关系、容量与图片绑定，再核对本节的基础原生对象。新文稿优先使用`compositionId`，减少逐页重写坐标；旧layoutTemplate和完整operations继续接受同样检查。

## 按内容单元选择

| 内容任务 | 优先原生组件 | 组合要求 |
| --- | --- | --- |
| 多组条件、同层分类与逐组解释 | conditions/classification 加 structure:'groups'，或 condition-groups / parallel-explanations → materials-filled-column、materials-badge-panel | 每组一个直角蓝标题白正文分栏或标签面板，同层保持同样结构 |
| 同类方法及适用条件、局限 | method-groups → 标签面板、直角蓝白分栏 | 方法标题与作用、条件和边界绑定，不按原文段落机械拆栏 |
| 专题、模块和证据组标题 | module-heading / group-heading / evidence-heading → materials-gradient-tab | 蓝底白字圆角标题与解释形成 contentGroup；孤立标签不构成正文结构 |
| 背景、定义、共性风险 | background / definition / definition-explanation / shared-risk → human-left-label-band 或标签面板 | 标签短、解释左上对齐；定义不冒充第三类 |
| 图旁解释、多组证据 | figure-explanation / evidence-groups / peer-evidence / text-with-evidence → 蓝白分栏或标签面板＋对应图片 | 明确图片支持哪个组，图片不能让其他散排文字自动合格 |
| 数值及其科学含义 | quantitative-evidence → 正常字号证据面板、表格或数据图 | 保留单位、条件和比较口径，不用大数字卡或KPI版式；图表无原型时先提取已授权原型 |
| 短条目 | 原任务加 structure:'items' → 原生方框、圆点、箭头、勾选 | 放在有标题的面板、有效圆角标题组或既有带边框列表内；裸列表不能独立成页 |
| 核心判断与共同结论 | 渐变总点、结论带 | 表达主从关系，不代替正文分组；只强调已有结论 |
| 时间、步骤、条件、汇合 | 原生 timeline / flow / outline / merge | 关系和槽位数量匹配；分类不画成因果链，段落符号不冒充连接线 |

reported-results 必须传 evidenceStatus:'reported'；设想和未来方向不用勾选。未知任务或关系/数量不匹配明确失败，不能回退成普通文字或任意画框。推荐是候选集合，仍须核对来源、容量及内容；不设每类组件必须出现的次数配额。

    const choice = recommendComponents({
      task: 'conditions', structure: 'groups', relation: 'parallel', itemCount: 2
    });
    const review = auditComposition(nativePlan);

## 禁用版式与字号

正文禁止普通文本直接组成单栏、双栏或三栏，仅改变字号、加粗和颜色仍属于散排文字。裸项目符号不能独立成页。公共页头、总点条、空面板、孤立标签和附加图片不能充当主体结构。

禁止大字号百分比、金额、面积、年份、数据亮点与KPI；放入真实面板也不豁免。数值随正常字号正文说明单位、条件和依据，或放入恰当表格/数据图。默认正文16–18pt，程序拦截超过24pt的数值文字及超过22pt的短数值块；原生时间轴日期、条目编号可至24pt，不能放大为数值主视觉。数值字号未知则失败。导出后读取实际run，图片内文字仍须逐页视觉复核。

封面/封底、目录、参考文献按实际职责排版，检查会核对对应对象和内容，不能只改 role 逃避。中性组件测试页只有与库内已登记 fixture 完全一致时才排除，不能用于正文交付。

## 圆角标题与解释绑定

面板自带标题和正文槽，按实际范围承载解释。独立圆角标题须给操作稳定 id，再在页面登记：

    "contentGroups": [{
      "id": "water-condition", "task": "condition-groups", "relation": "parallel",
      "bounds": [40, 188, 560, 450],
      "anchorId": "water-heading", "memberIds": ["water-body"]
    }]

anchorId 对应真实 materials-gradient-tab（或实际归组括号），memberIds 对应本组解释。标题和正文相邻，共同位于声明范围；不允许空标题、微小底框、跨栏罩住无关文字或重复归属。面板内的从属文字确实位于其内容区。手写 operations 接受相同检查。

同任务参考采用“标题—图片—正文”时，使用 `imageMemberIds:[图片操作ID]` 和 `moduleIds:[命题ID]` 声明中间图像；正文仍放 `memberIds`。图片必须绑定同一可见命题、位于该栏内并连续填补标题到正文之间的间隔。跨栏图片、未登记图片、错绑命题和无内容的大间隔仍失败。参见[对照修订](reference-fidelity.md)。

## 整稿复核与执行入口

auditComposition 先检查每页正文的结构覆盖与数值，再按实际承载正文的处理统计连续重复和全稿占比。公共页头、目录、图注及顶部总点不参与正文重复。连续三页同类主体，或八页以上正文中一种主体超过55%，需按内容复核；检查覆盖分栏、左标签、圆角标题组等所有主体。不能改 layoutFamily、组件名字或换色逃避，也不应随机换样式凑数量。

同一证据系列确需保持一致时，相关每页填相同的 compositionSeries:{id,reason,pageIds,sourceIds}，说明共同变量与槽位的一致性，列出对应页及本页已有来源ID。该记录仅解释重复，不能豁免纯文字、大数字、空组件和无归属正文。普通 compositionRationale 只作备注。

预置组合：parallel-filled-explanations（直角蓝白）、parallel-badge-explanations（标签面板）、parallel-titled-explanations（圆角标题绑定解释）。unordered-notes 和 paired-titled-notes 带圆角内容标题；旧名 paired-open-notes 为兼容别名，输出同样的结构化组合。时间、流程、图文模板仍按内容使用。

规划、build_deck.mjs、build_native_deck.mjs 均强制检查，旧版本字段不关闭它。原生导出后读取实际PPTX、计划和 native-bindings.json，核对可见文字、run字号、全局几何及锚点，生成 actual-composition-audit.json。独立复查：

    node scripts/audit_composition.mjs 制作目录/presentation.pptx 原生规划.json 制作目录/native-bindings.json 实际组合审查.json

finalize_deck.mjs 规划.json 候选.pptx 新定稿目录 [native-bindings.json] 在定稿前后复核；绑定文件缺失时停止。程序通过后仍需逐页查看实际视觉、图内大数字及分组关系，保留原生保真、容量和编辑保存重开的验收。


同时执行[页面任务、补图与总述对齐](visual-planning.md)：模块visualIntent、图旁正文净宽、自然内容稀疏复核和实际对齐检查共同约束选型与交付。顶部总述居中与普通正文左上对齐分别处理。
