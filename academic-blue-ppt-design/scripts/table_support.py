"""Address native table cells without treating them as invented shape objects."""
from lxml import etree as E
NS={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}

def apply_table_appearance(node,appearance='uniform-white-blue'):
    """Controlled instance styling; preserve the source table's lines and geometry."""
    if appearance!='uniform-white-blue':raise ValueError('TABLE_APPEARANCE_UNREGISTERED')
    tbl=node.find('.//a:tbl',NS)
    if tbl is None:raise ValueError('TABLE_APPEARANCE_ON_NON_TABLE')
    pr=tbl.find('a:tblPr',NS)
    pr.set('bandRow','0');pr.set('bandCol','0')
    for cell in tbl.findall('a:tr/a:tc',NS):
        cp=cell.find('a:tcPr',NS)
        if cp is None:cp=E.SubElement(cell,'{'+NS['a']+'}tcPr')
        for ch in list(cp):
            if E.QName(ch).localname in ['solidFill','gradFill','noFill','pattFill','blipFill','grpFill']:cp.remove(ch)
        fill=E.Element('{'+NS['a']+'}solidFill');E.SubElement(fill,'{'+NS['a']+'}srgbClr',{'val':'FFFFFF'})
        ext=cp.find('a:extLst',NS)
        if ext is None:cp.append(fill)
        else:cp.insert(cp.index(ext),fill)

def body_of(node):
    body=node.find('p:txBody',NS)
    return body if body is not None else node.find('a:txBody',NS)

def find_bound_node(root,name):
    parent_name,*cell_ref=name.split('.cell.')
    for node in root.iter():
        if node.tag.rsplit('}',1)[-1] not in ['sp','pic','graphicFrame']:continue
        prop=node.find('.//p:cNvPr',NS)
        if prop is not None and prop.get('name')==parent_name:
            if not cell_ref:return node
            rr,cc=map(int,cell_ref[0].split('.'))
            return node.findall('.//a:tbl/a:tr',NS)[rr].findall('a:tc',NS)[cc]
    return None
