# 满意斗地主 · 主屏幕图标生成（PIL 矢量绘制，无外部素材）
# 深绿牌桌底 + 扇形双牌(A♠ K♥) + 金色描边 + 「满意」金字
from PIL import Image, ImageDraw, ImageFont
import math, os

FONTS = '/Users/kenshin/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/python/fonts'
BOLD = f'{FONTS}/NotoSansSC-Bold.ttf'
OUT = '/Users/kenshin/claude/games/landlord-fight/public/icons'
os.makedirs(OUT, exist_ok=True)

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# ---- 圆角牌桌底：深绿渐变 + 内圈高光 ----
radius = 220
for y in range(S):
    t = y / S
    r = int(5 + (22 - 5) * t)
    g = int(46 + (101 - 46) * (1 - abs(t - 0.35) * 1.6))
    b = int(22 + (54 - 22) * t)
    d.line([(0, y), (S, y)], fill=(r, max(20, g), b, 255))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=radius, fill=255)
img.putalpha(mask)

# 桌面圆形高光
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([S*0.12, S*0.06, S*0.88, S*0.62], fill=(52, 211, 153, 46))
img = Image.alpha_composite(img, glow)
d = ImageDraw.Draw(img)

# 金色细边框
d.rounded_rectangle([28, 28, S-28, S-28], radius=radius-24, outline=(234, 179, 8, 210), width=10)

# ---- 扑克牌绘制 ----
def draw_card(base, cx, cy, w, h, angle, rank, suit, color):
    card = Image.new('RGBA', (int(w*1.6), int(h*1.6)), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([w*0.3, h*0.3, w*1.3, h*1.3], radius=w*0.12,
                         fill=(252, 252, 250, 255), outline=(203, 213, 225, 255), width=6)
    f_rank = ImageFont.truetype(BOLD, int(w*0.42))
    f_suit = ImageFont.truetype(BOLD, int(w*0.36))
    cd.text((w*0.42, h*0.36), rank, font=f_rank, fill=color)
    cd.text((w*0.42, h*0.36 + w*0.44), suit, font=f_suit, fill=color)
    # 中央大花色
    f_big = ImageFont.truetype(BOLD, int(w*0.62))
    cd.text((w*0.62, h*0.72), suit, font=f_big, fill=color)
    rot = card.rotate(angle, resample=Image.BICUBIC, expand=False)
    base.alpha_composite(rot, (int(cx - w*0.8), int(cy - h*0.8)))

cw, ch = 400, 560
draw_card(img, S*0.40, S*0.44, cw, ch, 12, 'A', '♠', (15, 23, 42, 255))
draw_card(img, S*0.62, S*0.46, cw, ch, -12, 'K', '♥', (220, 38, 38, 255))
d = ImageDraw.Draw(img)

# ---- 底部「满意」金字 ----
f_name = ImageFont.truetype(BOLD, 150)
text = '满意'
bbox = d.textbbox((0, 0), text, font=f_name)
tw = bbox[2] - bbox[0]
# 描边效果
for dx in (-5, 0, 5):
    for dy in (-5, 0, 5):
        d.text(((S-tw)/2 + dx, S*0.80 + dy), text, font=f_name, fill=(120, 53, 15, 255))
d.text(((S-tw)/2, S*0.80), text, font=f_name, fill=(250, 204, 21, 255))

# ---- 导出各尺寸 ----
specs = {
    'icon-512.png': 512,
    'icon-192.png': 192,
    'apple-touch-icon.png': 180,
    'favicon-32.png': 32,
}
for name, size in specs.items():
    img.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}')
    print('saved', name, size)
