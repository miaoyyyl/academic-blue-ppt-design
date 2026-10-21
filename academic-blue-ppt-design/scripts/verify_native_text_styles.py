"""Check actual native paragraph symbols, indents and editable emphasis runs."""
from pathlib import Path
from lxml import etree as E
import argparse,json,zipfile
from table_support import find_bound_node,body_of
ap=argparse.ArgumentParser();ap.add_argument('deck');ap.add_argument('plan');ap.add_argument('bindings');ap.add_argument('report');args=ap.parse_args()
read=lambda p:json.loads(Path(p).read_text('utf-8-sig'))
plan=read(args.plan);bindings=read(args.bindings);bank=Path(__file__).resolve().parents[1]/'assets/native-components'
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
checks=[];bullet_paras=0;emphasis_occurrences=0
with zipfile.ZipFile(args.deck) as z:
 for binding in bindings:
  if binding.get('text') is None:continue
  page=plan['pages'][binding['page']-1];op=page['operations'][binding['operation']];proto=read(bank/(op['typeId']+'.json'))
  opts={**proto.get('defaultTextOptions',{}).get(binding['slot'],{}),**op.get('textOptions',{}).get(binding['slot'],{})}
  root=E.fromstring(z.read(f'ppt/slides/slide{binding["page"]}.xml'))
  shape=find_bound_node(root,binding['name'])
  paras=body_of(shape).findall('a:p',NS)
  for pi,para in enumerate(paras):
   value=''.join(t.text or '' for t in para.findall('.//a:t',NS));pp=para.find('a:pPr',NS)
   if opts.get('bullet')=='source':
    ref=proto['bulletSource'];expected=bool(value.strip());ch=pp.find('a:buChar',NS);font=pp.find('a:buFont',NS)
    ok=(ch is not None and ch.get('char')==ref['char'] and font is not None and font.get('typeface')==ref['font']['typeface'] and pp.get('marL')==ref['marL'] and pp.get('indent')==ref['indent']) if expected else ch is None
    bullet_paras+=expected;checks.append({'check':'native_symbol_font_and_hanging_indent','page':binding['page'],'name':binding['name'],'paragraph':pi,'markerRole':proto.get('markerRole'),'pass':ok})
   colors=[];bold=[]
   for r in para.findall('a:r',NS):
    s=''.join(t.text or '' for t in r.findall('a:t',NS));rp=r.find('a:rPr',NS);clr=rp.find('a:solidFill/a:srgbClr',NS)
    colors.extend([clr.get('val') if clr is not None else None]*len(s));bold.extend([rp.get('b')=='1']*len(s))
   for emphasis in opts.get('emphasis',[]):
    start=0
    while True:
     i=value.find(emphasis['text'],start)
     if i<0:break
     end=i+len(emphasis['text']);expected=emphasis.get('color','C00000').lstrip('#')
     ok=all(c==expected for c in colors[i:end]) and (not emphasis.get('bold',True) or all(bold[i:end]));emphasis_occurrences+=1
     checks.append({'check':'editable_emphasis_runs','page':binding['page'],'name':binding['name'],'text':emphasis['text'],'pass':ok});start=end
report={'pass':all(c['pass'] for c in checks),'bulletParagraphs':bullet_paras,'emphasisOccurrences':emphasis_occurrences,'checks':checks}
Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({k:v for k,v in report.items() if k!='checks'}))
if not report['pass']:raise SystemExit(2)
