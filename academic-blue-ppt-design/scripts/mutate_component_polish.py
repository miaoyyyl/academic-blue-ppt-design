"""Generate actual-file negative fixtures; never alter the input deck."""
from pathlib import Path
import argparse,json,copy,zipfile
from lxml import etree as E

p=argparse.ArgumentParser();p.add_argument('deck');p.add_argument('bindings');p.add_argument('out');a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
bindings=json.loads(Path(a.bindings).read_text(encoding='utf-8-sig'))
with zipfile.ZipFile(a.deck) as z:base={n:z.read(n) for n in z.namelist()}
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
get=lambda typ,slot=None:next(b for b in bindings if b['typeId']==typ and (slot is None or b['slot']==slot))
def find(root,name):return next(s for s in root.findall('.//p:sp',ns) if s.find('p:nvSpPr/p:cNvPr',ns).get('name')==name)
def build(name,b,edit):
    data=dict(base);part=f"ppt/slides/slide{b['page']}.xml";root=E.fromstring(data[part]);edit(root,b)
    data[part]=E.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
    f=out/(name+'.pptx')
    with zipfile.ZipFile(f,'w',zipfile.ZIP_DEFLATED) as z:
        for n,v in data.items():z.writestr(n,v)
    return {'name':name,'file':str(f.resolve())}
cases=[]
tb=get('human-comparison-table')
cases.append(build('table-banding',tb,lambda r,b:r.find('.//a:tblPr',ns).set('bandRow','1')))
cases.append(build('table-residual-cell-fill',tb,lambda r,b:r.find('.//a:tr/a:tc/a:tcPr/a:solidFill/a:srgbClr',ns).set('val','CCDEEE')))
merge=get('materials-two-input-merge','input0')
cases.append(build('merge-top-anchor',merge,lambda r,b:find(r,b['name']).find('p:txBody/a:bodyPr',ns).set('anchor','t')))
def wide(r,b):
    shape=find(r,f"native.{b['operation']}.111");ext=shape.find('p:spPr/a:xfrm/a:ext',ns);ext.set('cx',str(int(ext.get('cx'))*2))
cases.append(build('merge-full-width',merge,wide))
fold=get('materials-folded-tab','heading')
def inside(r,b):
    for sid in ['22','23','24']:
        off=find(r,f"native.{b['operation']}.{sid}").find('p:spPr/a:xfrm/a:off',ns);off.set('x',str(int(off.get('x'))+28*9525))
cases.append(build('folded-inside-frame',fold,inside))
def low(r,b):
    off=find(r,b['name']).find('p:spPr/a:xfrm/a:off',ns);off.set('y',str(int(off.get('y'))+6*9525))
cases.append(build('folded-text-too-low',fold,low))
def footer(r,b):
    source=next(s for s in r.findall('.//p:sp',ns) if s.find('p:txBody',ns) is not None and s.find('.//a:t',ns) is not None)
    s=copy.deepcopy(source);pr=s.find('p:nvSpPr/p:cNvPr',ns);pr.set('id','98001');pr.set('name','unplanned-process-footer')
    tr=s.find('p:spPr/a:xfrm',ns);off=tr.find('a:off',ns);ext=tr.find('a:ext',ns);off.set('x',str(44*9525));off.set('y',str(681*9525));ext.set('cx',str(1190*9525));ext.set('cy',str(25*9525))
    ts=s.findall('.//a:t',ns)
    for t in ts:t.text=''
    ts[0].text='案例资料口径：待原始资料进一步核验'
    r.find('p:cSld/p:spTree',ns).append(s)
cases.append(build('extra-process-footer',fold,footer))
(out/'fixtures.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'fixtures':len(cases)}))
