from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json

root = Path(__file__).resolve().parent
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
bold_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
body = ImageFont.truetype(font_path, 14)
small = ImageFont.truetype(font_path, 12)
title = ImageFont.truetype(bold_path, 23)
label = ImageFont.truetype(bold_path, 16)
canvas = Image.new('RGB', (760, 454), '#11100F')
draw = ImageDraw.Draw(canvas)
draw.text((28, 18), 'Queen anchor candidates · native 1× proof', font=title, fill='#E5D7B3')
draw.text((28, 49), 'Open at 100%. Exact export sizes. Art approval pending; nothing installed.', font=small, fill='#BCAE96')
items = [('current-queen', 'Current QH'), ('queen-a', 'A · ornate crown'), ('queen-b', 'B · simpler crown'), ('reaper', 'Reaper'), ('material', 'Shared material')]
for mode, w, h, heading_y, card_y, text_y in [('desktop', 86, 121, 78, 106, 235), ('portrait', 60, 85, 281, 309, 403)]:
    draw.text((28, heading_y), f'{mode.upper()}  {w}×{h}px', font=label, fill='#E5D7B3')
    for i, (name, text) in enumerate(items):
        file = root/'previews'/f'{name}-{mode}-{w}x{h}.png'
        im = Image.open(file).convert('RGBA')
        assert im.size == (w, h), (file, im.size)
        x = 28 + i * 144
        canvas.paste(im, (x, card_y), im)
        draw.text((x, text_y), text, font=small, fill='#E5D7B3')
output = root/'native-size-proof.png'
canvas.save(output)
Image.open(output).verify()
manifest = json.loads((root/'asset-manifest.json').read_text())
manifest['nativeContactSheet'] = {'path':'native-size-proof.png','width':760,'height':454,'cardsDesktop':[86,121],'cardsPortrait':[60,85],'scale':'1×; display the contact sheet at native size, or use fixed-CSS-size HTML at 100% zoom'}
(root/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
json.loads((root/'asset-manifest.json').read_text())
print(output)
