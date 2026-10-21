"""Inspect real PPTX media, source windows and nested picture geometry without rasterizing."""
import hashlib,json,posixpath,sys,zipfile
from pathlib import Path
from lxml import etree as E
from PIL import Image
from io import BytesIO
from read_composition_evidence import shapes,NS
NS={**NS,'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

def inspect(deck,planfile,bindingsfile):
    plan=json.loads(Path(planfile).read_text('utf-8-sig')); bindings=json.loads(Path(bindingsfile).read_text('utf-8-sig')); results=[]
    with zipfile.ZipFile(deck) as z:
        for pg,page in enumerate(plan['pages'],1):
            part=f'ppt/slides/slide{pg}.xml'; root=E.fromstring(z.read(part)); actual=shapes(root.find('p:cSld/p:spTree',NS))
            rp=f'ppt/slides/_rels/slide{pg}.xml.rels';rels={r.get('Id'):r.get('Target') for r in E.fromstring(z.read(rp))}
            for b in bindings:
                if b['page']!=pg or b.get('slot')!='image':continue
                item={'page':pg,'pageId':page['id'],'operation':b['operation'],'name':b['name'],'assetId':b.get('assetId'),'sourceAssetSha256':b.get('sourceAssetSha256')}
                pic=actual.get(b['name'])
                if not pic:item['error']='ACTUAL_PICTURE_MISSING';results.append(item);continue
                node=pic['node'];blip=node.find('p:blipFill/a:blip',NS);rid=blip.get('{'+NS['r']+'}embed')
                media=posixpath.normpath(posixpath.join(posixpath.dirname(part),rels[rid]));blob=z.read(media)
                with Image.open(BytesIO(blob)) as im:dimensions=list(im.size)
                sr=node.find('p:blipFill/a:srcRect',NS)
                crop=[int(sr.get(k,'0'))/100000 if sr is not None else 0 for k in ['l','t','r','b']]
                item.update(actualBounds=pic['box'],imageCrop=crop,dimensions=dimensions,mediaPart=media,mediaSha256=hashlib.sha256(blob).hexdigest())
                results.append(item)
    return results

if __name__=='__main__':print(json.dumps(inspect(*sys.argv[1:]),ensure_ascii=False))
