# 蓝白科研 PPT Skill

从 Word 制作可编辑蓝白科研汇报，按论证关系、图片职责和页面容量选择原生组件与图文组合。

当前版本：`word-native-preview-17-reference-candidate`。这是 v17 候选版备份，包含48类原生基础组件和27类组合；尚未替换本机正式安装版。

## 内容

- `academic-blue-ppt-design/`：完整 skill，共310个文件。
- `dist/academic-blue-ppt-design-v17-candidate.zip`：同版压缩包，解压后得到标准 skill 目录。
- `dist/*.sha256`：压缩包 SHA-256。
- `docs/distribution-validation.json`：组件闭合、相对链接和中性内容等分发检查。
- `docs/package-manifest.json`：版本、文件清单和哈希。

## 本版能力

支持框内图文、区域嵌套、短标签、折角标题、关键词框、分支/汇合流程、说明卡与阶段轴、逐行小图映射、双侧问题与中央内容等结构。保留图文首尾对齐、白底蓝线表格、短节点居中、按内容收缩框体以及不显示制作验收脚注的规则。

组件按语义和容量选择，同主题内容优先合并，不机械轮换版式。图表和配图须由当前输入材料提供依据。skill 本身不包含论文 Word、作者身份、科研演示成品或默认科研答案。

## 使用

将 `academic-blue-ppt-design/` 作为 Codex skill 使用。若手动安装，先备份已有同名目录，再复制到本机 skills 目录。仓库上传不会自动改变本机安装。

制作依赖 Codex 内置 Node.js、Python 和 Presentations / Artifact Tool 运行时；Python 使用 lxml、Pillow。实际渲染和编辑保存检查使用 Windows PowerPoint。运行时不随本包分发，无需额外配置模型 API。

入口文档：[SKILL.md](academic-blue-ppt-design/SKILL.md)。具体依赖、生成及验证命令见[本机运行与重建](academic-blue-ppt-design/references/runtime-guide.md)。
