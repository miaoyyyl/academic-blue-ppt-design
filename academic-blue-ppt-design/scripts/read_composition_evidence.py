"""Read actual bound text, run sizes and global geometry from the exported PPTX."""
from pathlib import Path
from lxml import etree as E
import copy,json,re,sys,zipfile
from table_support import body_of
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
PX=9525
BLUE={'materials-gradient-tab':'33','materials-filled-column':'15','materials-badge-panel':'14','materials-flow-step':'81','human-left-label-band':'4'}
REGION={'materials-filled-column':'14','materials-badge-panel':'13','materials-flow-step':'80','human-left-label-band':'3'}
read=lambda p:json.loads(Path(p).read_text('utf-8-sig'))

def name(n):
    t=n.find('.//p:cNvPr',NS)
    return t.get('name','') if t is not None else ''

def painted(n):
    if n.find('.//a:tbl',NS) is not None:return True
    sp=n.find('p:spPr',NS)
    if sp is None:return False
    for el in sp:
        tag=E.QName(el).localname
        if tag in ['solidFill','gradFill','pattFill','blipFill','ln']:
            if tag=='ln' and el.find('a:noFill',NS) is not None:continue
            alphas=el.findall('.//a:alpha',NS)
            if not alphas or any(int(a.get('val','100000'))>0 for a in alphas):return True
    return False

def shapes(tree):
    found={}
    def walk(n,sx=1,sy=1,tx=0,ty=0):
        tag=E.QName(n).localname
        if tag not in ['sp','pic','grpSp','cxnSp','graphicFrame']:return
        xp='p:grpSpPr/a:xfrm' if tag=='grpSp' else 'p:xfrm' if tag=='graphicFrame' else 'p:spPr/a:xfrm'
        x=n.find(xp,NS)
        if x is None:return
        off=x.find('a:off',NS);ext=x.find('a:ext',NS)
        if off is None or ext is None:return
        ox,oy=int(off.get('x')),int(off.get('y'));w,h=int(ext.get('cx')),int(ext.get('cy'))
        rect=[(tx+sx*ox)/PX,(ty+sy*oy)/PX,sx*w/PX,sy*h/PX]
        if name(n) in found:raise ValueError('DUPLICATE_ACTUAL_SHAPE_NAME: '+name(n))
        found[name(n)]={'node':n,'box':rect,'painted':painted(n),'tag':tag,'zOrder':len(found)}
        if tag=='graphicFrame' and n.find('.//a:tbl',NS) is not None:
            cols=[int(c.get('w'))for c in n.findall('.//a:tblGrid/a:gridCol',NS)]
            rows=n.findall('.//a:tbl/a:tr',NS);heights=[int(r.get('h'))for r in rows]
            for rr,row in enumerate(rows):
                for cc,cell in enumerate(row.findall('a:tc',NS)):
                    cr=[rect[0]+rect[2]*sum(cols[:cc])/sum(cols),rect[1]+rect[3]*sum(heights[:rr])/sum(heights),rect[2]*cols[cc]/sum(cols),rect[3]*heights[rr]/sum(heights)]
                    found[name(n)+f'.cell.{rr}.{cc}']={'node':cell,'box':cr,'painted':True,'tag':'tc','zOrder':len(found)}
        if tag=='grpSp':
            co=x.find('a:chOff',NS);ce=x.find('a:chExt',NS)
            if co is None or ce is None:return
            nsx=sx*w/max(1,int(ce.get('cx')));nsy=sy*h/max(1,int(ce.get('cy')))
            ntx=tx+sx*ox-nsx*int(co.get('x'));nty=ty+sy*oy-nsy*int(co.get('y'))
            for child in n:walk(child,nsx,nsy,ntx,nty)
    for child in tree:walk(child)
    return found

def text_evidence(n):
    fields=[];runs=[]
    body=body_of(n)
    if body is None:return fields,runs
    for p in body.findall('a:p',NS):
        fields.append(''.join(t.text or '' for t in p.findall('.//a:t',NS)))
        default=p.find('a:pPr/a:defRPr',NS)
        inherited=default.get('sz') if default is not None else None
        for r in p:
            if E.QName(r).localname not in ['r','fld']:continue
            text=''.join(t.text or '' for t in r.findall('a:t',NS));rp=r.find('a:rPr',NS)
            size=rp.get('sz') if rp is not None else None
            if size is None:size=inherited
            if size is None:
                d=n.find('p:txBody/a:lstStyle/a:lvl1pPr/a:defRPr',NS)
                if d is not None:size=d.get('sz')
            runs.append({'text':text,'font':int(size)/100 if size else None})
    return fields,runs

def inspect(deck,plan_file,bindings_file):
    plan=copy.deepcopy(read(plan_file));bindings=read(bindings_file);issues=[];slot_count=0
    for p in plan['pages']:
        for o in p.get('operations',[]):
            for k in list(o):
                if k.startswith('_actual') or k=='_structureVisible':del o[k]
            o['_actualFields']={};o['_actualSlotBoxes']={};o['_actualTextRuns']={};o['_actualParagraphAlignments']={};o['_actualTextAnchors']={}
    with zipfile.ZipFile(deck) as z:
        slide_parts=sorted(n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide[0-9]+\.xml',n))
        if len(slide_parts)!=len(plan['pages']):issues.append({'code':'ACTUAL_SLIDE_COUNT_MISMATCH','expected':len(plan['pages']),'actual':len(slide_parts)})
        by_page={}
        for pg,page in enumerate(plan['pages'],1):
            part=f'ppt/slides/slide{pg}.xml'
            if part not in z.namelist():issues.append({'code':'ACTUAL_SLIDE_MISSING','page':pg});continue
            root=E.fromstring(z.read(part));actual=shapes(root.find('p:cSld/p:spTree',NS));by_page[pg]=actual
            bound={b['name'] for b in bindings if b['page']==pg}
            for nm,shape in actual.items():
                values,_=text_evidence(shape['node'])
                if any(v.strip() for v in values) and nm not in bound:issues.append({'code':'UNBOUND_VISIBLE_TEXT','page':pg,'name':nm})
            for ix,op in enumerate(page.get('operations',[])):
                sid=BLUE.get(op['typeId'])
                visual=actual.get(f'native.{ix}.{sid}') if sid else None
                parts=[v for k,v in actual.items() if k.startswith(f'native.{ix}.')]
                op['_actualNativeBoxes']={k.split('.')[2]:v['box'] for k,v in actual.items() if k.startswith(f'native.{ix}.') and '.cell.' not in k}
                table=next((v['node'].find('.//a:tbl',NS) for v in parts if v['node'].find('.//a:tbl',NS) is not None),None)
                if table is not None:
                    tp=table.find('a:tblPr',NS)
                    colors=[]
                    for cell in table.findall('a:tr/a:tc',NS):
                        fill=cell.find('a:tcPr/a:solidFill/a:srgbClr',NS)
                        color=fill.get('val','').upper() if fill is not None else 'INHERIT'
                        if fill is not None and any(int(n.get('val','100000'))!=100000 for n in fill.findall('a:alpha',NS)):color='NON_OPAQUE'
                        colors.append(color)
                    op['_actualTableAppearance']={'bandRow':tp.get('bandRow','0')in ['1','true','on'],'bandCol':tp.get('bandCol','0')in ['1','true','on'],'fills':colors}
                if parts:
                    tr=parts[0]['node'].find('p:grpSpPr/a:xfrm',NS)
                    if tr is None:tr=parts[0]['node'].find('p:spPr/a:xfrm',NS)
                    if tr is not None:op['_actualNativeTransform']={k:tr.get(k,'0')in ['1','true']for k in ['flipH','flipV']}
                if parts:op['_actualZOrder']=min(v['zOrder'] for v in parts)
                boxes=[v['box'] for v in parts if v['tag']!='grpSp']
                if boxes:
                    left=min(b[0] for b in boxes);top=min(b[1] for b in boxes)
                    op['_actualOperationBounds']=[left,top,max(b[0]+b[2] for b in boxes)-left,max(b[1]+b[3] for b in boxes)-top]
                if sid:
                    op['_structureVisible']=bool(visual and visual['painted'])
                    if visual:op['_actualAnchorBox']=visual['box']
                else:
                    minimum=20 if op['typeId']=='materials-circle-numbered-row' else 80
                    op['_structureVisible']=any(v['painted'] and max(v['box'][2:])>=minimum for v in parts)
                region=actual.get(f"native.{ix}.{REGION.get(op['typeId'])}")
                if region:op['_actualRegionBox']=region['box']
                if op['typeId']=='materials-paper-image':
                    pic=next((v for v in parts if v['tag']=='pic'),None)
                    if pic:op['bounds']=pic['box']
                if op['typeId'] in ['human-figure-frame-solid','materials-figure-frame-dashed','materials-mixed-region-frame']:
                    sp=parts[0]['node'] if len(parts)==1 else None
                    ln=sp.find('p:spPr/a:ln',NS) if sp is not None else None
                    dash=ln.find('a:prstDash',NS) if ln is not None else None
                    color=ln.find('a:solidFill/a:srgbClr',NS) if ln is not None else None
                    alphas=ln.findall('.//a:alpha',NS) if ln is not None else []
                    prop=sp.find('p:nvSpPr/p:cNvPr',NS) if sp is not None else None
                    op['_actualFrame']={'shapeCount':len(parts),'visible':ln is not None and ln.find('a:noFill',NS) is None and int(ln.get('w','0'))>0 and color is not None and all(int(a.get('val','0'))==100000 for a in alphas) and prop is not None and prop.get('hidden','0') not in ['1','true'],
                        'dash':dash.get('val') if dash is not None else 'solid','widthPt':int(ln.get('w','0'))/12700 if ln is not None else 0,'color':color.get('val') if color is not None else None}
        for b in bindings:
            try:op=plan['pages'][b['page']-1]['operations'][b['operation']]
            except (IndexError,KeyError):issues.append({'code':'BINDING_OPERATION_MISSING','binding':b});continue
            shape=by_page.get(b['page'],{}).get(b['name'])
            if shape is None:issues.append({'code':'BOUND_ACTUAL_SHAPE_MISSING','page':b['page'],'name':b['name']});continue
            if b.get('slot')=='image':continue
            values,runs=text_evidence(shape['node']);slot=b['slot'];slot_count+=1
            op['_actualFields'][slot]=values;op['_actualSlotBoxes'][slot]=shape['box'];op['_actualTextRuns'][slot]=runs
            body=body_of(shape['node'])
            pr=body.find('a:bodyPr',NS) if body is not None else None
            op['_actualTextAnchors'][slot]=pr.get('anchor','t') if pr is not None else 't'
            op['_actualParagraphAlignments'][slot]=[(p.find('a:pPr',NS).get('algn','l') if p.find('a:pPr',NS) is not None else 'l') for p in body.findall('a:p',NS) if ''.join(p.itertext()).strip()] if body is not None else []
            original=op.get('fields',{}).get(slot)
            expected=original if isinstance(original,list) else str(original or '').split('\n')
            if (values or [''])!=(expected or ['']):issues.append({'code':'ACTUAL_BOUND_TEXT_CHANGED','page':b['page'],'operation':b['operation'],'slot':slot})
        for pg,page in enumerate(plan['pages'],1):
            for ix,op in enumerate(page.get('operations',[])):
                for slot,v in op.get('fields',{}).items():
                    if slot!='image' and slot not in op['_actualFields']:issues.append({'code':'ACTUAL_SLOT_NOT_INSPECTED','page':pg,'operation':ix,'slot':slot})
    return {'plan':plan,'issues':issues,'textSlots':slot_count,'slideCount':len(slide_parts)}

if __name__=='__main__':
    if len(sys.argv)!=4:raise SystemExit('Usage: read_composition_evidence.py deck.pptx plan.json native-bindings.json')
    print(json.dumps(inspect(*sys.argv[1:]),ensure_ascii=False))
