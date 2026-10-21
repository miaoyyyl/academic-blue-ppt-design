"""Read native audience text in real presentation order, excluding notes."""
import json,posixpath,sys,zipfile
from lxml import etree as E
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
parser=E.XMLParser(resolve_entities=False,no_network=True)
items=[]
with zipfile.ZipFile(sys.argv[1]) as z:
    rels={r.get('Id'):r.get('Target') for r in E.fromstring(z.read('ppt/_rels/presentation.xml.rels'),parser)}
    pres=E.fromstring(z.read('ppt/presentation.xml'),parser)
    def resolve(target):return target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('ppt',target))
    parts=[resolve(rels[s.get('{'+NS['r']+'}id')]) for s in pres.findall('./p:sldIdLst/p:sldId',NS)]
    for page,part in enumerate(parts,1):
        root=E.fromstring(z.read(part),parser)
        for shape in root.xpath('.//p:sp | .//p:graphicFrame',namespaces=NS):
            if any(c.get('hidden')=='1' for parent in [shape,*shape.iterancestors()] for c in parent.xpath('./p:nvSpPr/p:cNvPr | ./p:nvGrpSpPr/p:cNvPr | ./p:nvGraphicFramePr/p:cNvPr',namespaces=NS)):continue
            props=shape.xpath('./p:nvSpPr/p:cNvPr | ./p:nvGraphicFramePr/p:cNvPr',namespaces=NS)
            text='\n'.join(''.join(t.text or '' for t in p.findall('.//a:t',NS)) for p in shape.findall('.//a:p',NS))
            if text.strip():items.append({'page':page,'part':part,'name':props[0].get('name') if props else '', 'text':text})
print(json.dumps({'slides':len(parts),'items':items},ensure_ascii=False))
