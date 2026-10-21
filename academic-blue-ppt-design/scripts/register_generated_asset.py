from pathlib import Path
import argparse, hashlib, json, shutil
p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('image');p.add_argument('--id',required=True);p.add_argument('--prompt-file',required=True);p.add_argument('--source-ids',nargs='+',required=True);a=p.parse_args()
m=Path(a.manifest).resolve();data=json.loads(m.read_text(encoding='utf-8-sig'));src=Path(a.image).resolve();out=m.parent/'assets'/('generated-'+a.id+src.suffix.lower())
if any(x['asset_id']==a.id for x in data['assets']):raise ValueError('ASSET_ID_ALREADY_REGISTERED')
out.parent.mkdir(exist_ok=True);shutil.copy2(src,out)
from PIL import Image
with Image.open(out) as im:dims=list(im.size)
data['assets'].append({'asset_id':a.id,'kind':'generated-illustration','path':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'dimensions':dims,'source_word_sha256':data['source_word_sha256'],'source_ids':a.source_ids,'prompt':Path(a.prompt_file).read_text(encoding='utf-8'),'caption':'基于正文的学术示意图'})
m.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');print(out)
