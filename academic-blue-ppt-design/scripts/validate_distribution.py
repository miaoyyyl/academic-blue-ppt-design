"""Validate a self-contained, content-free native materials skill package."""
from pathlib import Path
from lxml import etree as E
import argparse,hashlib,json,re,zipfile
ap=argparse.ArgumentParser();ap.add_argument('skill');ap.add_argument('report');a=ap.parse_args();root=Path(a.skill).resolve();bank=root/'assets/native-components';checks=[]
def check(code,ok,detail=None):checks.append({'check':code,'pass':bool(ok),'detail':detail})
read=lambda p:json.loads(Path(p).read_text('utf-8-sig'))
skill=(root/'SKILL.md').read_text('utf-8');check('frontmatter',skill.startswith('---\nname: academic-blue-ppt-design\n'))
for f in root.rglob('*.md'):
 for _,target in re.findall(r'\[([^\]]+)\]\(([^)]+)\)',f.read_text('utf-8')):
  if not target.startswith(('http:','https:','#')):check('local_link',(f.parent/target.split('#')[0]).exists(),str(f.relative_to(root))+' -> '+target)
version=read(root/'version.json');registry=read(bank/'registry.json');check('active_renderer',version['activeRenderer']=='materials-native-clone');check('type_count',len(registry)==version['componentSpecifications']and len(registry)>=12)
check('no_legacy_geometry',(not(root/'assets/generic-components').exists())and not list(root.rglob('*legacy*')))
check('no_default_word',not list(root.rglob('*.docx')))
check('only_neutral_root_pptx',set(p.relative_to(root).as_posix()for p in root.rglob('*.pptx'))=={'assets/native-components/native-root.pptx'})
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
for r in registry:
 p=read(bank/(r['typeId']+'.json'));check('source_closure',p['sourceFile'].startswith(('materials/','by_human/'))and len(p['sourceFileSha256'])==64 and p['nativeOnly']and p['noGeometryFallback'],p['typeId'])
 ids=set()
 for o in p['objects']:
  e=E.fromstring(o['xml'].encode());ids.update(n.get('id')for n in e.findall('.//p:cNvPr',ns));check('neutral_prototype_text',not any((t.text or'').strip()for t in e.findall('.//a:t',ns)),p['typeId'])
  for ref in re.findall(r'BANK_ASSET:([^"<]+)',o['xml']):check('decoration_asset',(bank/'assets'/ref).is_file(),ref)
 check('slots_point_to_native_objects',all(v.split('.cell.')[0] in ids for v in p['slots'].values()),p['typeId'])
 for case in ['standard','capacity','optional']:
  f=bank/'examples'/(p['typeId']+'-'+case+'.json');check('three_scenario_example',f.is_file(),f.name)
with zipfile.ZipFile(bank/'native-root.pptx')as z:
 check('no_source_thumbnail',not any('thumbnail'in n for n in z.namelist()))
 check('no_source_slides',not any(re.fullmatch(r'ppt/slides/slide[0-9]+\.xml',n)for n in z.namelist()))
 check('no_source_text',not any((t.text or'').strip()for n in z.namelist()if n.endswith('.xml')for t in E.fromstring(z.read(n)).findall('.//a:t',ns)))
for f in root.rglob('*'):
 if f.is_file()and f.resolve()!=Path(__file__).resolve()and f.suffix in ['.md','.mjs','.py','.json','.yaml']:
  s=f.read_text('utf-8-sig');check('no_default_fixture_or_machine_path',not any(x in s for x in ['word-ppt-v1','C:\\Users\\miaoy','source-baseline-repaired']),str(f.relative_to(root)))
report={'pass':all(x['pass']for x in checks),'checks':checks,'types':len(registry),'examples':len(list((bank/'examples').glob('*.json'))),'files':[{'path':str(f.relative_to(root)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}for f in root.rglob('*')if f.is_file()and '__pycache__'not in f.parts]}
Path(a.report).parent.mkdir(parents=True,exist_ok=True);Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({'pass':report['pass'],'checks':len(checks),'failed':[x for x in checks if not x['pass']]},ensure_ascii=False))
if not report['pass']:raise SystemExit(2)
