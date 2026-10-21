from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse,math
p=argparse.ArgumentParser();p.add_argument('previews');p.add_argument('output');p.add_argument('--columns',type=int,default=4);p.add_argument('--rows',type=int,default=3);a=p.parse_args()
files=sorted(Path(a.previews).glob('slide-*.png'));out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15) if Path('C:/Windows/Fonts/msyh.ttc').exists() else ImageFont.load_default()
w,h=384,216;per=a.columns*a.rows
for chunk in range(math.ceil(len(files)/per)):
 group=files[chunk*per:(chunk+1)*per];sheet=Image.new('RGB',(a.columns*(w+12)+12,a.rows*(h+38)+12),'#e8e8e8');d=ImageDraw.Draw(sheet)
 for i,f in enumerate(group):
  with Image.open(f) as im:im.thumbnail((w,h));x=12+i%a.columns*(w+12);y=12+i//a.columns*(h+38);sheet.paste(im,(x,y));d.text((x,y+h+4),str(chunk*per+i+1),font=font,fill='#111111')
 sheet.save(out/f'contact-{chunk+1:02d}.png')
print({'pages':len(files),'contacts':math.ceil(len(files)/per)})
