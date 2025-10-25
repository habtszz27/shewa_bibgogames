from PIL import Image, ImageDraw, ImageFont
import os

def generate_card_image(numbers, out_path):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img = Image.new('RGB', (500, 500), color=(255,255,255))
    d = ImageDraw.Draw(img)
    cell = 100
    for i in range(6):
        d.line([(0, i*cell), (500, i*cell)], fill=(0,0,0), width=2)
        d.line([(i*cell, 0), (i*cell, 500)], fill=(0,0,0), width=2)
    try:
        font = ImageFont.truetype('arial.ttf', 28)
    except:
        font = ImageFont.load_default()
    for idx, n in enumerate(numbers):
        r, c = divmod(idx, 5)
        text = 'FREE' if idx == 12 else ('' if n==0 else str(n))
        w, h = d.textsize(text, font=font)
        x = c*100 + (100-w)//2
        y = r*100 + (100-h)//2
        d.text((x, y), text, fill=(0,0,0), font=font)
    img.save(out_path)
    return out_path
