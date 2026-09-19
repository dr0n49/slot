from PIL import Image
import collections
p = "/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/frontend/public/assets/_pack_work/H7.png"
im = Image.open(p).convert("RGBA")
print("H7", im.size)
# sample non-white pixels
colors = collections.Counter()
for px in im.getdata():
    if px[3] < 200: continue
    if px[0] > 240 and px[1] > 240 and px[2] > 240: continue
    colors[(px[0]//8*8, px[1]//8*8, px[2]//8*8)] += 1
print("top colors", colors.most_common(8))

sheet = "/Users/andriinorenko/.cursor/projects/Users-andriinorenko-slot-math-sdk/assets/3769d6e2-99c7-4f5a-9d1c-b40da7a08abe-b0dee6ee-41f2-4978-8b64-63b79258a110.webp"
sim = Image.open(sheet)
print("sheet", sim.format, sim.mode, sim.size)
