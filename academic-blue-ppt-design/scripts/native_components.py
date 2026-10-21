"""Copy approved native template objects, retaining their OOXML drawing styles.

Uses zip/XML only. It never creates decorative geometry or rasterizes a slide.
The public bank contains neutral text, native objects and required decoration.
"""
from pathlib import Path
import argparse, copy, hashlib, json, posixpath, re, zipfile, math
from lxml import etree as ET
from table_support import apply_table_appearance

NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a':'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL='http://schemas.openxmlformats.org/package/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
for k,v in NS.items():ET.register_namespace(k,v)
EMU=914400;PX=9525
def sha(data):return hashlib.sha256(data).hexdigest()
def image_crop(value):
    value=[0,0,0,0] if value is None else value
    if not isinstance(value,list) or len(value)!=4 or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<0 or v>=1 for v in value):raise ValueError('IMAGE_CROP_INVALID')
    value=[round(v*100000)/100000 for v in value]
    if value[0]+value[2]>=1 or value[1]+value[3]>=1:raise ValueError('IMAGE_CROP_INVALID')
    return value
def read_json(p):return json.loads(Path(p).read_text('utf-8-sig'))
def xml(data):return ET.fromstring(data.encode('utf-8')if isinstance(data,str)else data)
def emit(root):
    return ET.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
def relpath(part):return posixpath.dirname(part)+'/_rels/'+posixpath.basename(part)+'.rels'
def resolve(part,target):return posixpath.normpath(posixpath.join(posixpath.dirname(part),target)).lstrip('/')
def parts(path):
    with zipfile.ZipFile(path)as z:return {n:z.read(n)for n in z.namelist()if not n.endswith('/')}
def write_parts(path,data):
    Path(path).parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED)as z:
        for n,b in sorted(data.items()):z.writestr(n,b)
def ident(el):
    n=el.find('.//p:cNvPr',NS);return n.get('id')if n is not None else None
def shape_type(el):return el.tag.rsplit('}',1)[-1]
def xfrm(el):
    return el.find('p:grpSpPr/a:xfrm',NS)if shape_type(el)=='grpSp'else el.find('p:xfrm',NS)if shape_type(el)=='graphicFrame'else el.find('p:spPr/a:xfrm',NS)
def box(el):
    x=xfrm(el)
    if x is None:return [0,0,0,0]
    off=x.find('a:off',NS);ext=x.find('a:ext',NS)
    return [int(off.get('x')),int(off.get('y')),int(ext.get('cx')),int(ext.get('cy'))]
def bbox(elements):
    bs=[box(e)for e in elements];return [min(b[0]for b in bs),min(b[1]for b in bs),max(b[0]+b[2]for b in bs)-min(b[0]for b in bs),max(b[1]+b[3]for b in bs)-min(b[1]for b in bs)]
def text(el):return '\n'.join(''.join(t.text or ''for t in p.findall('.//a:t',NS))for p in el.findall('.//a:p',NS))
def clear_text(el):
    for t in el.findall('.//a:t',NS):t.text=''
    for fld in el.findall('.//a:fld',NS):
        for t in fld.findall('.//a:t',NS):t.text=''
def geometry_fingerprint(el):
    c=copy.deepcopy(el)
    for n in list(c.iter()):
        if n.tag.rsplit('}',1)[-1]in ['txBody','cNvPr','xfrm']:
            for p in c.iter():
                if n in list(p):p.remove(n);break
    return sha(emit(c))
def prototype(z,page,ids,slotmap):
    part=f'ppt/slides/slide{page}.xml';root=xml(z[part]);tree=root.find('p:cSld/p:spTree',NS)
    selected=[copy.deepcopy(e)for e in tree if ident(e)in set(map(str,ids))]
    if len(selected)!=len(ids):raise ValueError(f'SOURCE_OBJECT_NOT_FOUND page={page} ids={ids}')
    relationships={r.get('Id'):r for r in xml(z[relpath(part)])}if relpath(part)in z else {}
    assets={};entries=[]
    picture_ids=set(str(v)for v in slotmap.values()if isinstance(v,(str,int)))if 'image'in slotmap else set()
    for e in selected:
        oid=ident(e);original=copy.deepcopy(e);clear_text(e)
        # Internal links point at old source slides and have no visual role.
        # Collect first: mutating a live nested iterator can skip a group's tags.
        for n in list(e.iter()):
            if ET.QName(n).localname in ['hlinkClick','hlinkMouseOver','tags','custDataLst']:
                parent=n.getparent()
                if parent is not None:parent.remove(n)
        for blip in e.findall('.//a:blip',NS):
            rid=blip.get('{'+NS['r']+'}embed')
            if not rid:continue
            if oid==str(slotmap.get('image')):
                blip.set('{'+NS['r']+'}embed','ASSET_SLOT')
                for child in list(blip):blip.remove(child)
            else:
                rel=relationships[rid];target=resolve(part,rel.get('Target'));b=z[target];name=sha(b)+Path(target).suffix.lower();assets[name]=b;blip.set('{'+NS['r']+'}embed','BANK_ASSET:'+name)
        entries.append({'sourceId':oid,'xml':emit(e).decode(),'geometryStyleSha256':geometry_fingerprint(original),'sourceBoundsEmu':box(original)})
    return {'sourcePage':page,'sourceObjectIds':list(map(str,ids)),'sourceBoundsEmu':bbox(selected),'slots':{k:str(v)for k,v in slotmap.items()},'objects':entries},assets

def prune(data):
    seen={'[Content_Types].xml'};todo=['_rels/.rels']
    while todo:
        part=todo.pop()
        if part in seen or part not in data:continue
        seen.add(part)
        if part.endswith('.rels'):
            base=''if part=='_rels/.rels'else part.replace('/_rels/','/').removesuffix('.rels')
            for r in xml(data[part]):
                if r.get('TargetMode')=='External':continue
                target=resolve(base,r.get('Target'));todo.append(target);todo.append(relpath(target))
    ct=xml(data['[Content_Types].xml'])
    for n in list(ct):
        if n.tag.endswith('Override')and n.get('PartName','').lstrip('/')not in seen:ct.remove(n)
    result={k:v for k,v in data.items()if k in seen};result['[Content_Types].xml']=emit(ct);return result

def build_bank(materials,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);assetsdir=out/'assets';assetsdir.mkdir(exist_ok=True)
    source=Path(materials)/'3深蓝白色系-国家自然科学项目申请答辩结题汇报PPT.pptx';z=parts(source)
    # Source object sets are reviewed on actual materials slides, not inferred wireframes.
    definitions=[
      ('materials-frame','frame',18,[4,5,7,10,6],{'title':7,'number':6}),
      ('materials-cover','cover',1,[8,60,31,37,32,5,1026,13],{'title':37,'subtitle':27,'meta':20}),
      ('materials-navigation','section',2,[61,2058,35,37,166,168,169,170,172,173,174,176,177,178,180,181,182,184,185,167,171,175,179,183],{'item0':168,'item1':172,'item2':176,'item3':180,'item4':184,'num0':169,'num1':173,'num2':177,'num3':181,'num4':185}),
      ('materials-badge-panel','parallel',18,[13,14,15,16],{'heading':15,'body':16}),
      ('materials-filled-column','parallel',9,[14,15,16,48],{'heading':16,'body':48}),
      ('materials-statement-band','statement',18,[11,12],{'body':12}),
      ('materials-text','text',14,[13],{'body':13}),
      ('materials-caption','caption',9,[45],{'body':45}),
      ('materials-flow-step','flow',6,[80,81,91,106],{'heading':106,'body':91}),
      ('materials-flow-arrow','flow',6,[89],{}),
      ('materials-side-label','hierarchy',6,[103],{'body':103}),
    ]
    p12=xml(z['ppt/slides/slide12.xml']);pics=[e for e in p12.find('p:cSld/p:spTree',NS)if shape_type(e)=='pic'and box(e)[1]>EMU]
    image_id=int(ident(max(pics,key=lambda e:box(e)[2]*box(e)[3])))
    definitions.append(('materials-paper-image','figure',12,[image_id],{'image':image_id}))
    p6=xml(z['ppt/slides/slide6.xml']);arrows=[e for e in p6.find('p:cSld/p:spTree',NS)if any(g.get('prst')=='rightArrow'for g in e.findall('.//a:prstGeom',NS))]
    registry=[]
    for typeid,relation,page,ids,slots in definitions:
        p,assets=prototype(z,page,ids,slots)
        if typeid in ['materials-cover','materials-navigation']:p['sourceBoundsEmu']=[0,0,12192000,6858000]
        p.update({'typeId':typeid,'relation':relation,'sourceFile':'materials/'+source.name,'sourceFileSha256':sha(source.read_bytes()),'nativeOnly':True,'noGeometryFallback':True})
        p.update({'repeatable':relation in ['parallel','flow','text','caption','figure'],'itemCount':1,'capacityPolicy':'Explicit font and slot bounds; actual PowerPoint fit check is mandatory. Never shrink or truncate.'})
        (out/(typeid+'.json')).write_text(json.dumps(p,ensure_ascii=False,indent=2),'utf-8')
        for name,b in assets.items():(assetsdir/name).write_bytes(b)
        registry.append({k:v for k,v in p.items()if k!='objects'})
    (out/'registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2),'utf-8')
    # Keep only master/layout/background dependencies. No original content slide/media survives.
    root=copy.deepcopy(z);pres=xml(root['ppt/presentation.xml']);lst=pres.find('p:sldIdLst',NS)
    for n in list(lst):lst.remove(n)
    for tag in ['notesMasterIdLst','custShowLst','sectionLst','custDataLst']:
        for n in pres.findall('p:'+tag,NS):pres.remove(n)
    root['ppt/presentation.xml']=emit(pres);rels=xml(root['ppt/_rels/presentation.xml.rels'])
    for r in list(rels):
        if r.get('Type','').rsplit('/',1)[-1]in ['slide','notesMaster','commentAuthors','tags']:rels.remove(r)
    root['ppt/_rels/presentation.xml.rels']=emit(rels)
    package_rels=xml(root['_rels/.rels'])
    for rel in list(package_rels):
        if rel.get('Type','').endswith('/thumbnail'):package_rels.remove(rel)
    root['_rels/.rels']=emit(package_rels)
    for n in ['docProps/core.xml','docProps/app.xml']:
        if n in root:
            t=xml(root[n])
            for e in list(t):t.remove(e)
            root[n]=emit(t)
    root=prune(root)
    # Any placeholder text in unused retained layouts is neutral, never source scientific text.
    for n,b in list(root.items()):
        if n.startswith('ppt/')and n.endswith('.xml'):
            t=xml(b);clear_text(t);root[n]=emit(t)
    write_parts(out/'native-root.pptx',root)
    print(json.dumps({'ok':True,'components':len(registry),'source':source.name,'rootParts':len(root),'decorationAssets':len(list(assetsdir.iterdir()))},ensure_ascii=False))

def remap_box(el,origin,target):
    x=xfrm(el)
    if x is None:return
    b=box(el);sx=target[2]/origin[2];sy=target[3]/origin[3]
    off=x.find('a:off',NS);ext=x.find('a:ext',NS)
    off.set('x',str(round(target[0]+(b[0]-origin[0])*sx)));off.set('y',str(round(target[1]+(b[1]-origin[1])*sy)))
    ext.set('cx',str(max(1,round(b[2]*sx))));ext.set('cy',str(max(1,round(b[3]*sy))))
    if shape_type(el)=='graphicFrame':
        for col in el.findall('.//a:tblGrid/a:gridCol',NS):col.set('w',str(max(1,round(int(col.get('w'))*sx))))
        for row in el.findall('.//a:tbl/a:tr',NS):row.set('h',str(max(1,round(int(row.get('h'))*sy))))

def global_to_parent_box(el,target):
    """Text options use slide coordinates even when the native slot is nested."""
    ancestors=[];parent=el.getparent()
    while parent is not None:
        if shape_type(parent)=='grpSp':ancestors.append(parent)
        parent=parent.getparent()
    sx=sy=1.0;tx=ty=0.0
    for group in reversed(ancestors):
        tr=xfrm(group);off=tr.find('a:off',NS);ext=tr.find('a:ext',NS)
        co=tr.find('a:chOff',NS);ce=tr.find('a:chExt',NS)
        if co is None or ce is None:continue
        nsx=sx*int(ext.get('cx'))/max(1,int(ce.get('cx')))
        nsy=sy*int(ext.get('cy'))/max(1,int(ce.get('cy')))
        tx=tx+sx*int(off.get('x'))-nsx*int(co.get('x'))
        ty=ty+sy*int(off.get('y'))-nsy*int(co.get('y'))
        sx,sy=nsx,nsy
    return [round((target[0]-tx)/sx),round((target[1]-ty)/sy),round(target[2]/sx),round(target[3]/sy)]

def fill_text(el,value,font=None,bold=None,color=None,align=None,inset=0,leading=100,labelBold=False,vAlign='t',bullet=None,paragraphAfter=None,emphasis=None):
    body=el.find('p:txBody',NS)
    if body is None:body=el.find('a:txBody',NS)
    if body is None:raise ValueError('SOURCE_TEXT_SLOT_MISSING')
    if shape_type(el)=='tc':
        cellpr=el.find('a:tcPr',NS)
        if cellpr is None:cellpr=ET.SubElement(el,'{'+NS['a']+'}tcPr')
        cellpr.set('anchor',vAlign)
        for side in ['marL','marR','marT','marB']:cellpr.set(side,str(round(float(inset)*PX)))
    original=body.findall('a:p',NS);first=original[0]if original else ET.Element('{'+NS['a']+'}p')
    source_pp=next((p.find('a:pPr',NS) for p in original if p.find('a:pPr/a:buChar',NS) is not None),None)
    if bullet not in [None,'none','source']:raise ValueError('INVALID_NATIVE_BULLET_MODE')
    if bullet=='source' and source_pp is None:raise ValueError('NATIVE_BULLET_TEMPLATE_MISSING')
    choices=[]
    for r in body.findall('.//a:r',NS):
        rp=r.find('a:rPr',NS)
        if rp is not None:choices.append((len(''.join(r.itertext())),rp))
    rp=copy.deepcopy(max(choices,key=lambda x:x[0])[1])if choices else ET.Element('{'+NS['a']+'}rPr')
    if font is not None:rp.set('sz',str(round(float(font)*100)))
    if bold is not None:rp.set('b','1'if bold else'0')
    rp.set('spc','0');rp.set('baseline','0')
    if color:
        for n in list(rp):
            if n.tag.endswith('Fill'):rp.remove(n)
        f=ET.Element('{'+NS['a']+'}solidFill');ET.SubElement(f,'{'+NS['a']+'}srgbClr',{'val':color.lstrip('#')});rp.insert(0,f)
    # User's established font pair; graphical geometry/effects remain the material's objects.
    for tag,family in [('latin','DIN Next LT Pro'),('ea','Microsoft YaHei')]:
        face=rp.find('a:'+tag,NS)
        if face is None:face=ET.SubElement(rp,'{'+NS['a']+'}'+tag)
        face.set('typeface',family)
    bpr=body.find('a:bodyPr',NS)
    if bpr is not None:
        for n in list(bpr):
            if n.tag.rsplit('}',1)[-1]in ['normAutofit','spAutoFit','noAutofit']:bpr.remove(n)
        ET.SubElement(bpr,'{'+NS['a']+'}noAutofit')
        if vAlign not in ['t','ctr','b']:raise ValueError('INVALID_VERTICAL_ALIGNMENT')
        bpr.set('anchor',vAlign);bpr.set('wrap','square')
        for side in ['lIns','rIns','tIns','bIns']:bpr.set(side,str(round(float(inset)*PX)))
    for p in original:body.remove(p)
    paras=(value or [''])if isinstance(value,list)else str(value or'').split('\n')
    for v in paras:
        p=ET.SubElement(body,'{'+NS['a']+'}p');pp=ET.Element('{'+NS['a']+'}pPr')
        use_bullet=bullet=='source' and bool(str(v).strip())
        pp.set('marL',source_pp.get('marL','0') if use_bullet else '0');pp.set('indent',source_pp.get('indent','0') if use_bullet else '0');pp.set('algn',align or'l')
        sp=ET.SubElement(pp,'{'+NS['a']+'}lnSpc');ET.SubElement(sp,'{'+NS['a']+'}spcPct',{'val':str(round(float(leading)*1000))})
        aft=ET.SubElement(pp,'{'+NS['a']+'}spcAft');ET.SubElement(aft,'{'+NS['a']+'}spcPts',{'val':str(round(float(paragraphAfter)*100)) if paragraphAfter is not None else '100'})
        if use_bullet:
            for item in source_pp:
                if ET.QName(item).localname in ['buClrTx','buClr','buSzTx','buSzPct','buSzPts','buFontTx','buFont','buChar']:pp.append(copy.deepcopy(item))
        else:ET.SubElement(pp,'{'+NS['a']+'}buNone')
        p.append(pp)
        label=re.match(r'^([^：:]{1,10}[：:])(.*)$',str(v))if labelBold else None
        value_text=str(v);prefix_end=len(label.group(1)) if label else 0;marks=[];cuts={0,len(value_text),prefix_end}
        for item in emphasis or []:
            start=0
            while True:
                i=value_text.find(item['text'],start)
                if i<0:break
                end=i+len(item['text']);marks.append((i,end,item));cuts.update([i,end]);start=end
        points=sorted(cuts)
        for a,b in zip(points,points[1:]):
            if a==b:continue
            s=value_text[a:b];selected=next((m for lo,hi,m in reversed(marks) if lo<=a and b<=hi),None)
            strong=bool(bold) or (label is not None and b<=prefix_end) or bool(selected and selected.get('bold',True))
            r=ET.SubElement(p,'{'+NS['a']+'}r');runpr=copy.deepcopy(rp)
            if strong:runpr.set('b','1')
            if selected:
                for node in list(runpr):
                    if ET.QName(node).localname.endswith('Fill'):runpr.remove(node)
                fill=ET.Element('{'+NS['a']+'}solidFill');ET.SubElement(fill,'{'+NS['a']+'}srgbClr',{'val':selected.get('color','C00000').lstrip('#')});runpr.insert(0,fill)
            r.append(runpr);t=ET.SubElement(r,'{'+NS['a']+'}t');t.text=s

def render(bank,opsfile,seed,output,manifest_path):
    bank=Path(bank);data=parts(bank/'native-root.pptx');ops=read_json(opsfile);assets=read_json(manifest_path);manifestdir=Path(manifest_path).resolve().parent
    registered={x['asset_id']:x for x in assets['assets']};seedparts=parts(seed);pres=xml(data['ppt/presentation.xml']);ids=pres.find('p:sldIdLst',NS);prels=xml(data['ppt/_rels/presentation.xml.rels']);ct=xml(data['[Content_Types].xml']);bindings=[];assetlog=[];nativecount=0
    defaults={n.get('Extension'):n.get('ContentType')for n in ct if n.tag.endswith('Default')}
    # Import the current Artifact Tool notes master under its own namespace.
    notesmaster='ppt/notesMasters/notesMaster1.xml';notes_prefix='ppt/notesNative/'
    def notes_target(n):return notes_prefix+n.removeprefix('ppt/')
    seen_notes=set()
    def import_notes(n):
        if n in seen_notes or n not in seedparts:return
        seen_notes.add(n);dest=notes_target(n);data[dest]=seedparts[n]
        seedct=xml(seedparts['[Content_Types].xml'])
        for ce in seedct:
            if ce.get('PartName')=='/'+n:ET.SubElement(ct,'{'+CT+'}Override',{'PartName':'/'+dest,'ContentType':ce.get('ContentType')})
        rp=relpath(n)
        if rp in seedparts:
            nr=xml(seedparts[rp])
            for rr in nr:
                if rr.get('TargetMode')!='External':
                    source_target=resolve(n,rr.get('Target'));import_notes(source_target);rr.set('Target',posixpath.relpath(notes_target(source_target),posixpath.dirname(dest)))
            data[relpath(dest)]=emit(nr)
    if notesmaster in seedparts:
        import_notes(notesmaster);nl=ET.Element('{'+NS['p']+'}notesMasterIdLst');pres.insert(1,nl);ET.SubElement(nl,'{'+NS['p']+'}notesMasterId',{'{'+NS['r']+'}id':'nativeNotesMaster'});ET.SubElement(prels,'{'+REL+'}Relationship',{'Id':'nativeNotesMaster','Type':NS['r']+'/notesMaster','Target':notes_target(notesmaster).removeprefix('ppt/')})
    def media(blob,ext):
        name=f'ppt/media/native-{sha(blob)[:24]}{ext}';data[name]=blob
        if ext.lstrip('.')not in defaults:
            mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.wdp':'image/vnd.ms-photo'}.get(ext,'application/octet-stream')
            ET.SubElement(ct,'{'+CT+'}Default',{'Extension':ext.lstrip('.'),'ContentType':mime});defaults[ext.lstrip('.')]=mime
        return name
    def add_override(name,kind):ET.SubElement(ct,'{'+CT+'}Override',{'PartName':'/'+name,'ContentType':kind})
    for pageidx,page in enumerate(ops['pages'],1):
        sld=ET.Element('{'+NS['p']+'}sld',nsmap=NS);cs=ET.SubElement(sld,'{'+NS['p']+'}cSld');tree=ET.SubElement(cs,'{'+NS['p']+'}spTree');nv=ET.SubElement(tree,'{'+NS['p']+'}nvGrpSpPr');ET.SubElement(nv,'{'+NS['p']+'}cNvPr',{'id':'1','name':''});ET.SubElement(nv,'{'+NS['p']+'}cNvGrpSpPr');ET.SubElement(nv,'{'+NS['p']+'}nvPr');ET.SubElement(tree,'{'+NS['p']+'}grpSpPr');relroot=ET.Element('{'+REL+'}Relationships',nsmap={None:REL});ET.SubElement(relroot,'{'+REL+'}Relationship',{'Id':'rId1','Type':NS['r']+'/slideLayout','Target':'../slideLayouts/slideLayout2.xml'});nextid=2
        for opindex,op in enumerate(page['operations']):
            proto=read_json(bank/(op['typeId']+'.json'));origin=proto['sourceBoundsEmu'];target=[round(float(x)*PX)for x in op['bounds']];fields=op.get('fields',{});elements=[];idmap={}
            for entry in proto['objects']:
                e=xml(entry['xml']);remap_box(e,origin,target)
                if e.find('.//a:tbl',NS) is not None:apply_table_appearance(e,op.get('tableAppearance','uniform-white-blue'))
                if op.get('nativeTransform'):
                    tr=xfrm(e)
                    for k,v in op['nativeTransform'].items():
                        if k not in ['flipH','flipV'] or not isinstance(v,bool):raise ValueError('NATIVE_TRANSFORM_INVALID')
                        if v:tr.set(k,'0' if tr.get(k,'0')in ['1','true'] else '1')
                if shape_type(e)=='graphicFrame' and op.get('tableColumnWeights'):
                    cols=e.findall('.//a:tblGrid/a:gridCol',NS);weights=op['tableColumnWeights']
                    if len(cols)!=len(weights) or min(weights)<=0:raise ValueError('TABLE_COLUMN_WEIGHTS_INVALID')
                    for col,weight in zip(cols,weights):col.set('w',str(round(target[2]*weight/sum(weights))))
                    rows=e.findall('.//a:tbl/a:tr',NS);weights=op.get('tableRowWeights',[1]*len(rows))
                    if len(rows)!=len(weights) or min(weights)<=0:raise ValueError('TABLE_ROW_WEIGHTS_INVALID')
                    for row,weight in zip(rows,weights):row.set('h',str(round(target[3]*weight/sum(weights))))
                for obj in e.iter():
                    if shape_type(obj) not in ['sp','pic','grpSp','graphicFrame','cxnSp']:continue
                    sid=ident(obj)
                    if sid in op.get('objectBoxes',{}):
                        requested=[round(float(v)*PX)for v in op['objectBoxes'][sid]]
                        remap_box(obj,box(obj),global_to_parent_box(obj,requested))
                if op['typeId']=='materials-navigation'and entry['sourceId']in ['166','170','174','178','182','167','171','175','179','183']:
                    rowids=['166','170','174','178','182'] if entry['sourceId']in ['166','170','174','178','182'] else ['167','171','175','179','183']
                    active=rowids[op.get('activeIndex',0)]
                    styleid=rowids[0]if entry['sourceId']==active else rowids[1]
                    src=xml(next(it['xml']for it in proto['objects']if it['sourceId']==styleid)).find('p:spPr',NS)
                    dst=e.find('p:spPr',NS)
                    for c in list(dst):
                        if c.tag.rsplit('}',1)[-1]!='xfrm':dst.remove(c)
                    for c in src:
                        if c.tag.rsplit('}',1)[-1]!='xfrm':dst.append(copy.deepcopy(c))
                for cn in e.findall('.//p:cNvPr',NS):
                    old=cn.get('id');idmap[old]=str(nextid);cn.set('id',str(nextid));cn.set('name',f'native.{opindex}.{old}');nextid+=1
                elements.append((entry,e))
            for entry,e in elements:
                for parent in e.iter():
                    for node in list(parent):
                        if node.tag.rsplit('}',1)[-1]in ['stCxn','endCxn']:
                            if node.get('id')in idmap:node.set('id',idmap[node.get('id')])
                            else:parent.remove(node)
                for slot,sid in proto['slots'].items():
                    cell_ref=sid.split('.cell.') if '.cell.' in sid else None
                    parent_sid=cell_ref[0] if cell_ref else sid
                    targetel=next((n for n in e.iter()if ident(n)==idmap.get(parent_sid)and shape_type(n)in ['sp','pic','graphicFrame']),None)
                    if targetel is None:continue
                    parentel=targetel
                    if cell_ref:
                        rr,cc=map(int,cell_ref[1].split('.'));targetel=parentel.findall('.//a:tbl/a:tr',NS)[rr].findall('a:tc',NS)[cc]
                    value=fields.get(slot)
                    if slot=='image':
                        aid=op.get('assetId');record=registered.get(aid)
                        if not record:raise ValueError(f'UNREGISTERED_ASSET {aid}')
                        f=(manifestdir/record['path']).resolve()
                        if not f.is_relative_to(manifestdir/'assets')or sha(f.read_bytes())!=record['sha256']:raise ValueError('ASSET_PATH_OR_HASH_CHANGED')
                        from PIL import Image
                        with Image.open(f)as im:iw,ih=im.size
                        crop=image_crop(op.get('imageCrop'));vw=iw*(1-crop[0]-crop[2]);vh=ih*(1-crop[1]-crop[3])
                        bx=box(targetel);scale=min(bx[2]/vw,bx[3]/vh);alignment=op.get('imageAlign')or'center'
                        dx=0 if alignment=='left-top'else bx[2]-vw*scale if alignment=='right-top'else(bx[2]-vw*scale)/2
                        dy=0 if alignment.endswith('-top')else(bx[3]-vh*scale)/2
                        new=[round(bx[0]+dx),round(bx[1]+dy),round(vw*scale),round(vh*scale)];remap_box(targetel,bx,new)
                        bf=targetel.find('p:blipFill',NS);src=bf.find('a:srcRect',NS)
                        if src is not None:bf.remove(src)
                        if any(crop):
                            sr=ET.Element('{'+NS['a']+'}srcRect',{k:str(round(v*100000))for k,v in zip(['l','t','r','b'],crop)})
                            bf.insert(list(bf).index(bf.find('a:blip',NS))+1,sr)
                        blip=bf.find('a:blip',NS);name=media(f.read_bytes(),f.suffix.lower());rid='rId'+str(len(relroot)+1);blip.set('{'+NS['r']+'}embed',rid);ET.SubElement(relroot,'{'+REL+'}Relationship',{'Id':rid,'Type':NS['r']+'/image','Target':'../media/'+Path(name).name});assetlog.append({'page':pageidx,'assetId':aid,'path':str(f),'sha256':record['sha256']})
                    elif value is not None:
                        opts=op.get('textOptions',{}).get(slot,{})
                        fill_text(targetel,value,**{k:v for k,v in opts.items()if k in ['font','bold','color','align','inset','leading','labelBold','vAlign','bullet','paragraphAfter','emphasis']})
                        if opts.get('box') and not cell_ref:
                            remap_box(targetel,box(targetel),global_to_parent_box(targetel,[round(float(v)*PX)for v in opts['box']]))
                    binding_name=parentel.find('.//p:cNvPr',NS).get('name')+('.cell.'+cell_ref[1] if cell_ref else '')
                    bindings.append({'page':pageidx,'operation':opindex,'typeId':op['typeId'],'slot':slot,'name':binding_name,'objectId':ident(parentel),'text':value,'assetId':op.get('assetId')if slot=='image'else None,'sourceFile':proto['sourceFile'],'sourceSha256':proto['sourceFileSha256'],'sourcePage':proto['sourcePage'],'sourceObjectId':sid,**({'sourceAssetSha256':record['sha256'],'imageCrop':crop,'originalImageSize':[iw,ih],'requestedImageBounds':[v/PX for v in bx],'actualDisplayBounds':[v/PX for v in new]}if slot=='image'else{})})
                for blip in e.findall('.//a:blip',NS):
                    ref=blip.get('{'+NS['r']+'}embed','')
                    if ref.startswith('BANK_ASSET:'):
                        f=bank/'assets'/ref.split(':',1)[1];name=media(f.read_bytes(),f.suffix);rid='rId'+str(len(relroot)+1);blip.set('{'+NS['r']+'}embed',rid);ET.SubElement(relroot,'{'+REL+'}Relationship',{'Id':rid,'Type':NS['r']+'/image','Target':'../media/'+Path(name).name})
                tree.append(e);nativecount+=1
        # Preserve source master background and attach only this run's speaker notes.
        clr=ET.SubElement(sld,'{'+NS['p']+'}clrMapOvr');ET.SubElement(clr,'{'+NS['a']+'}masterClrMapping')
        name=f'ppt/slides/slide{pageidx}.xml';data[name]=emit(sld);data[relpath(name)]=emit(relroot);ET.SubElement(ids,'{'+NS['p']+'}sldId',{'id':str(255+pageidx),'{'+NS['r']+'}id':'nativeSlide'+str(pageidx)});ET.SubElement(prels,'{'+REL+'}Relationship',{'Id':'nativeSlide'+str(pageidx),'Type':NS['r']+'/slide','Target':'slides/slide'+str(pageidx)+'.xml'});add_override(name,'application/vnd.openxmlformats-officedocument.presentationml.slide+xml')
        # Artifact Tool notes are generated from the current page plan, never from the template.
        seednote=f'ppt/notesSlides/notesSlide{pageidx}.xml'
        if seednote in seedparts:
            data[seednote]=seedparts[seednote];nr=ET.Element('{'+REL+'}Relationships',nsmap={None:REL});ET.SubElement(nr,'{'+REL+'}Relationship',{'Id':'rId2','Type':NS['r']+'/slide','Target':'../slides/slide'+str(pageidx)+'.xml'})
            if notesmaster in seedparts:ET.SubElement(nr,'{'+REL+'}Relationship',{'Id':'rId1','Type':NS['r']+'/notesMaster','Target':'../notesNative/notesMasters/notesMaster1.xml'})
            data[relpath(seednote)]=emit(nr);ET.SubElement(relroot,'{'+REL+'}Relationship',{'Id':'nativeNotes','Type':NS['r']+'/notesSlide','Target':'../notesSlides/notesSlide'+str(pageidx)+'.xml'});data[relpath(name)]=emit(relroot);add_override(seednote,'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml')
    data['ppt/presentation.xml']=emit(pres);data['ppt/_rels/presentation.xml.rels']=emit(prels);data['[Content_Types].xml']=emit(ct);data=prune(data);write_parts(output,data)
    out=Path(output).parent;(out/'native-bindings.json').write_text(json.dumps(bindings,ensure_ascii=False,indent=2),'utf-8');(out/'asset-access.json').write_text(json.dumps(assetlog,ensure_ascii=False,indent=2),'utf-8');(out/'native-build.json').write_text(json.dumps({'ok':True,'pages':len(ops['pages']),'nativeClonedTopLevelObjects':nativecount,'drawnFallbackObjects':0,'pptxSha256':sha(Path(output).read_bytes())},indent=2),'utf-8');print(json.dumps({'ok':True,'pages':len(ops['pages']),'nativeObjects':nativecount,'fallbackObjects':0}))

if __name__=='__main__':
    ap=argparse.ArgumentParser();sub=ap.add_subparsers(dest='mode',required=True);b=sub.add_parser('build-bank');b.add_argument('materials');b.add_argument('output');r=sub.add_parser('render');r.add_argument('bank');r.add_argument('operations');r.add_argument('seed');r.add_argument('output');r.add_argument('manifest');a=ap.parse_args()
    if a.mode=='build-bank':build_bank(a.materials,a.output)
    else:render(a.bank,a.operations,a.seed,a.output,a.manifest)
