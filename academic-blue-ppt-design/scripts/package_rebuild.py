"""Package a frozen plan, this Word's inputs, and the generic skill for relocation."""
from pathlib import Path
import argparse,copy,hashlib,json,re,shutil
p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('source');p.add_argument('manifest');p.add_argument('output');a=p.parse_args()
skill=Path(__file__).resolve().parents[1];out=Path(a.output).resolve();source_path=Path(a.source).resolve();manifest_path=Path(a.manifest).resolve()
if out==skill or out.is_relative_to(skill):raise ValueError('OUTPUT_MUST_BE_OUTSIDE_SKILL')
if out.exists()and any(out.iterdir()):raise FileExistsError('OUTPUT_MUST_BE_EMPTY')
read=lambda f:json.loads(Path(f).read_text(encoding='utf-8-sig'))
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
source=read(source_path);manifest=read(manifest_path);plan=read(a.plan)
word=(source_path.parent/source['source']['path']).resolve()
if sha(word)!=source['source']['sha256']or manifest['source_word_sha256']!=source['source']['sha256']:raise ValueError('SOURCE_WORD_CHANGED')
asset_root=(manifest_path.parent/'assets').resolve();assets=[];ids=set()
for item in manifest['assets']:
 aid=item['asset_id']
 if not re.fullmatch(r'[A-Za-z0-9_-]+',aid)or aid in ids:raise ValueError('INVALID_ASSET_ID')
 ids.add(aid);f=(manifest_path.parent/item['path']).resolve()
 if not f.is_relative_to(asset_root)or sha(f)!=item['sha256']:raise ValueError('ASSET_PATH_OR_HASH_INVALID')
 assets.append((item,f,aid+f.suffix.lower()))
out.mkdir(parents=True,exist_ok=True);input_dir=out/'input';(input_dir/'assets').mkdir(parents=True)
shutil.copy2(word,input_dir/'source.docx');source=copy.deepcopy(source);source['source']['path']='source.docx'
names={item['asset_id']:name for item,f,name in assets}
for item,f,name in assets:shutil.copy2(f,input_dir/'assets'/name);item['path']='assets/'+name
for item in source['assets']:item['path']='assets/'+names[item['asset_id']]
for name,value in [('source-bundle.json',source),('asset-manifest.json',manifest)]:
 (input_dir/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
if plan.get('sourceWord'):plan['sourceWord']['path']='input/source.docx'
if plan.get('manualReference',{}).get('path'):plan['manualReference']['path']=Path(plan['manualReference']['path']).name
(out/'deck-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copytree(skill,out/'skill',ignore=shutil.ignore_patterns('__pycache__','*.pyc','.git'))
script=r'''param([string]$NodePath='', [string]$PythonPath='', [switch]$Render)
$ErrorActionPreference='Stop';$taskRoot=$PSScriptRoot
$taskNode=if($NodePath){$NodePath}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
$taskPython=if($PythonPath){$PythonPath}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'}
if(-not(Test-Path -LiteralPath $taskNode)){throw '请用-NodePath指定本机Node。'}
if(-not(Test-Path -LiteralPath $taskPython)){throw '请用-PythonPath指定本机Python。'}
$taskPreviousPython=$env:PPT_PYTHON_EXECUTABLE;$env:PPT_PYTHON_EXECUTABLE=$taskPython
try{
 $taskPlan=Join-Path $taskRoot 'deck-plan.json';$taskSource=Join-Path $taskRoot 'input/source-bundle.json';$taskManifest=Join-Path $taskRoot 'input/asset-manifest.json';$taskBuild=Join-Path $taskRoot 'build'
 & $taskNode (Join-Path $taskRoot 'skill/scripts/build_deck.mjs') $taskPlan $taskSource $taskManifest $taskBuild
 if($LASTEXITCODE -ne 0){throw '组件制作失败，查看具体容量或来源错误。'}
 $taskStamp=Get-Date -Format 'yyyyMMdd-HHmmss-fff';$taskFinal=Join-Path $taskRoot ('final-'+$taskStamp)
 & $taskNode (Join-Path $taskRoot 'skill/scripts/finalize_deck.mjs') $taskPlan (Join-Path $taskBuild 'presentation.pptx') $taskFinal
 if($LASTEXITCODE -ne 0){throw '官方定稿检查失败。'}
 $taskDeck=Join-Path $taskFinal 'presentation.pptx';$taskBindings=Join-Path $taskBuild 'native-bindings.json'
 & $taskPython (Join-Path $taskRoot 'skill/scripts/verify_native_deck.py') $taskDeck $taskBindings (Join-Path $taskRoot ('native-'+$taskStamp+'.json'))
 if($LASTEXITCODE -ne 0){throw '原生来源、图像或实际文字检查失败。'}
 & $taskPython (Join-Path $taskRoot 'skill/scripts/verify_native_text_styles.py') $taskDeck $taskPlan $taskBindings (Join-Path $taskRoot ('native-text-'+$taskStamp+'.json'))
 if($LASTEXITCODE -ne 0){throw '原生符号、字体、缩进或强调文字检查失败。'}
 if($Render){
  $taskRender=Join-Path $taskRoot ('render-'+$taskStamp)
  & (Join-Path $taskRoot 'skill/scripts/render_check.ps1') -DeckPath $taskDeck -OutputDir $taskRender -PlanPath $taskPlan -BindingsPath $taskBindings
  if($LASTEXITCODE -ne 0){throw 'PowerPoint实际渲染检查失败。'}
  & (Join-Path $taskRoot 'skill/scripts/inspect_native_lines.ps1') -DeckPath $taskDeck -ReportPath (Join-Path $taskRender 'native-lines.json')
  if($LASTEXITCODE -ne 0){throw '实际换行需人工修订。'}
  & $taskPython (Join-Path $taskRoot 'skill/scripts/verify_rendered_text.py') $taskPlan $taskBindings (Join-Path $taskRender 'powerpoint-check.json') (Join-Path $taskRender 'rendered-fonts.json')
  if($LASTEXITCODE -ne 0){throw 'PowerPoint实际字号或组合节点文字不适配。'}
 }
 Write-Output ('REBUILD_COMPLETE '+$taskDeck)
}finally{$env:PPT_PYTHON_EXECUTABLE=$taskPreviousPython}
'''
(out/'rebuild.ps1').write_text(script,encoding='utf-8-sig')
(out/'README.md').write_text('''# 冻结规划重建包

`deck-plan.json` 是本次已提炼的规划真源；`input` 保存Word与登记资产，`skill` 保存通用实现。
输入路径均相对于JSON，可把整个目录搬到其他位置。需要本机Node、Python、Artifact Tool及Presentations runtime；实际渲染需要PowerPoint。

在本目录运行 `./rebuild.ps1` 制作并完成结构/图片检查；使用 `./rebuild.ps1 -Render` 另做PowerPoint渲染与实际行检查。
可用 `-NodePath`、`-PythonPath` 指定本机运行时；SDK目录与Presentations路径配置见skill/references/runtime-guide.md。

此脚本重建冻结规划，不重新调用模型写内容。用新的Word时应重新提取与规划，不把本包输入作为skill默认题材。
重建后的内容判断仍以本次验收记录为准；如果修改规划或素材，需重新核对实际页面。
''',encoding='utf-8')
files=[{'path':f.relative_to(out).as_posix(),'sha256':sha(f)}for f in sorted(out.rglob('*'))if f.is_file()]
(out/'input-manifest.json').write_text(json.dumps({'word_sha256':source['source']['sha256'],'pages':len(plan['pages']),'files':files},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ok':True,'output':str(out),'pages':len(plan['pages']),'assets':len(assets),'files':len(files)},ensure_ascii=False))
