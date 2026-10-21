"""Verify actual PPTX native shape origin, appearance, images and visible slot text."""
from pathlib import Path
from lxml import etree as E
import argparse,copy,hashlib,json,posixpath,zipfile
from PIL import Image
from table_support import find_bound_node,body_of,apply_table_appearance
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def read(p):return json.loads(Path(p).read_text('utf-8-sig'))
def fingerprint(e):
 c=copy.deepcopy(e)
 for n in list(c.iter()):
  tag=E.QName(n).localname
  if tag in ['nvSpPr','nvPicPr','nvGrpSpPr','nvCxnSpPr','nvGraphicFramePr','txBody','blipFill','stCxn','endCxn']:
   par=n.getparent()
   if par is not None:par.remove(n)
  elif tag=='xfrm':
   for ch in list(n):n.remove(ch)
  elif tag in ['gridCol','tr']:
   n.attrib.pop('w',None);n.attrib.pop('h',None)
  elif tag=='tcPr':
   for attr in ['anchor','marL','marR','marT','marB']:n.attrib.pop(attr,None)
 def canon(n):return[n.tag,sorted(n.attrib.items()),n.text or'',[canon(x)for x in n]]
 return hashlib.sha256(json.dumps(canon(c),ensure_ascii=False).encode()).hexdigest()
def getname(e):
 n=e.find('.//p:cNvPr',NS);return n.get('name')if n is not None else None
def main():
 ap=argparse.ArgumentParser();ap.add_argument('deck');ap.add_argument('bindings');ap.add_argument('report');ap.add_argument('--bank',default=str(Path(__file__).resolve().parents[1]/'assets/native-components'));args=ap.parse_args()
 bank=Path(args.bank);base=Path(args.bindings).resolve().parent;ops=read(base/'native-operations.json');bindings=read(args.bindings);log=read(base/'asset-access.json');checks=[]
 def check(code,ok,**d):checks.append({'check':code,'pass':bool(ok),**d})
 with zipfile.ZipFile(args.deck)as z:
  topcount=0
  for pg,page in enumerate(ops['pages'],1):
   root=E.fromstring(z.read(f'ppt/slides/slide{pg}.xml'));tree=root.find('p:cSld/p:spTree',NS);actual={getname(e):e for e in list(tree)[2:]};topcount+=len(actual)
   for ix,op in enumerate(page['operations']):
    p=read(bank/(op['typeId']+'.json'))
    for item in p['objects']:
     name=f"native.{ix}.{item['sourceId']}";target=actual.get(name);source=E.fromstring(item['xml'].encode())
     if source.find('.//a:tbl',NS) is not None:apply_table_appearance(source,op.get('tableAppearance','uniform-white-blue'))
     if op.get('nativeTransform'):
      allowed=op['typeId']in ['materials-feedback-return','materials-flow-arrow','materials-gradient-connector','materials-brace-group']and all(k in ['flipH','flipV']and isinstance(v,bool) for k,v in op['nativeTransform'].items())
      check('declared_native_vector_transform',allowed,page=pg,name=name)
      if allowed:
       tr=source.find('p:grpSpPr/a:xfrm',NS)
       if tr is None:tr=source.find('p:spPr/a:xfrm',NS)
       for k,v in op['nativeTransform'].items():
        if v:tr.set(k,'0'if tr.get(k,'0')in ['1','true']else'1')
     if op['typeId']=='materials-navigation'and item['sourceId']in ['166','170','174','178','182','167','171','175','179','183']:
      rowids=['166','170','174','178','182'] if item['sourceId']in ['166','170','174','178','182'] else ['167','171','175','179','183']
      active=rowids[op.get('activeIndex',0)];sid=rowids[0]if item['sourceId']==active else rowids[1]
      template=E.fromstring(next(i['xml']for i in p['objects']if i['sourceId']==sid).encode())
      srcpr=source.find('p:spPr',NS);tpr=template.find('p:spPr',NS)
      for n in list(srcpr):
       if E.QName(n).localname!='xfrm':srcpr.remove(n)
      for n in tpr:
       if E.QName(n).localname!='xfrm':srcpr.append(copy.deepcopy(n))
     check('native_shape_fidelity',target is not None and fingerprint(source)==fingerprint(target),page=pg,name=name,typeId=op['typeId'],sourcePage=p['sourcePage'],sourceObjectId=item['sourceId'])
  for b in bindings:
   pg=b['page'];root=E.fromstring(z.read(f'ppt/slides/slide{pg}.xml'));target=find_bound_node(root,b['name'])
   if b.get('assetId'):
    item=next(x for x in log if x['page']==pg and x['assetId']==b['assetId']);relroot=E.fromstring(z.read(f'ppt/slides/_rels/slide{pg}.xml.rels'));rid=target.find('p:blipFill/a:blip',NS).get('{'+NS['r']+'}embed');r=next(r for r in relroot if r.get('Id')==rid);name=posixpath.normpath('ppt/slides/'+r.get('Target'));blob=z.read(name)
    check('word_image_bytes',hashlib.sha256(blob).hexdigest()==item['sha256'],page=pg,assetId=b['assetId'])
    import io
    with Image.open(io.BytesIO(blob))as im:iw,ih=im.size
    ext=target.find('p:spPr/a:xfrm/a:ext',NS);ratio=int(ext.get('cx'))/int(ext.get('cy'))
    sr=target.find('p:blipFill/a:srcRect',NS);actual_crop=[int(sr.get(k,'0'))/100000 if sr is not None else 0 for k in ['l','t','r','b']]
    expected_crop=ops['pages'][pg-1]['operations'][b['operation']].get('imageCrop',[0,0,0,0])
    check('image_source_window',all(abs(v-e)<0.000011 for v,e in zip(actual_crop,expected_crop)),page=pg,assetId=b['assetId'])
    l,t,r,bt=actual_crop
    check('word_image_aspect',abs(ratio-iw*(1-l-r)/(ih*(1-t-bt)))<0.0001,page=pg,assetId=b['assetId'])
   elif b.get('text')is not None:
    expected=b['text']if isinstance(b['text'],list)else str(b['text']).split('\n')
    actual=[''.join(p.itertext())for p in body_of(target).findall('a:p',NS)]
    check('visible_slot_text',actual==(expected or['']),page=pg,name=b['name'])
 report={'pass':all(c['pass']for c in checks),'pages':len(ops['pages']),'nativeTopLevelObjects':topcount,'nativeSourceTypesUsed':sorted(set(o['typeId']for p in ops['pages']for o in p['operations'])),'wordImages':len(log),'checks':checks}
 Path(args.report).parent.mkdir(parents=True,exist_ok=True);Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8');print(json.dumps({k:v for k,v in report.items()if k!='checks'},ensure_ascii=False))
 if not report['pass']:raise SystemExit(2)
if __name__=='__main__':main()
