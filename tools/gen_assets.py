# 저작권 클린한 배경 에셋 생성 (잔디 전장 / 양피지 지도).
import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 1280, 800
random.seed(7)

def noise_layer(sigma=22):
    return Image.effect_noise((W, H), sigma).convert("L")

def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def vignette(strength=140):
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.ellipse([-W*0.25, -H*0.25, W*1.25, H*1.25], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGBA", (W, H), (0,0,0,strength))
    inv = ImageChops.invert(m)
    dark.putalpha(inv.point(lambda p: int(p*strength/255)))
    return dark

# ── 잔디 전장 ───────────────────────────────────────────
def battlefield():
    top, mid, bot = (78,92,58), (108,124,74), (84,98,60)
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        c = lerp(top, mid, t*2) if t < 0.5 else lerp(mid, bot, (t-0.5)*2)
        for x in range(W):
            px[x, y] = c
    # 거친 풀 텍스처(노이즈 오버레이)
    n = noise_layer(20).convert("RGB")
    img = ImageChops.overlay(img, n)
    # 붓터치 얼룩(밝고 어두운 패치)
    blobs = Image.new("RGBA", (W, H), (0,0,0,0))
    bd = ImageDraw.Draw(blobs)
    for _ in range(260):
        x, y = random.randint(0, W), random.randint(0, H)
        r = random.randint(18, 70)
        shade = random.choice([(60,72,42), (124,140,86), (92,108,64), (70,84,50)])
        a = random.randint(18, 46)
        bd.ellipse([x-r, y-r//2, x+r, y+r//2], fill=shade+(a,))
    blobs = blobs.filter(ImageFilter.GaussianBlur(6))
    img = Image.alpha_composite(img.convert("RGBA"), blobs)
    # 가운데 짓밟힌 흙길(교전선)
    dirt = Image.new("RGBA", (W, H), (0,0,0,0))
    dd = ImageDraw.Draw(dirt)
    for _ in range(140):
        x = random.randint(0, W); y = int(H*0.5 + random.gauss(0, 40))
        r = random.randint(6, 22)
        dd.ellipse([x-r, y-r//2, x+r, y+r//2], fill=(96,78,52,random.randint(30,70)))
    dirt = dirt.filter(ImageFilter.GaussianBlur(4))
    img = Image.alpha_composite(img, dirt)
    img = Image.alpha_composite(img, vignette(150))
    img.convert("RGB").save("assets/bg/battle.png")
    print("assets/bg/battle.png", img.size)

# ── 양피지 지도 ─────────────────────────────────────────
def warmap():
    base = Image.new("RGB", (W, H))
    px = base.load()
    cx, cy = W/2, H*0.42
    inner, outer = (223,201,162), (140,113,76)
    maxd = math.hypot(W*0.7, H*0.7)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x-cx, y-cy)/maxd
            px[x, y] = lerp(inner, outer, min(1, d))
    n = noise_layer(16).convert("RGB")
    img = ImageChops.overlay(base, n).convert("RGBA")
    dr = ImageDraw.Draw(img, "RGBA")
    ink = (74, 58, 36)
    # 강
    pts = [(-20, 470)]
    for i in range(1, 14):
        pts.append((i*W/13, 470 + math.sin(i*0.7)*60))
    dr.line(pts, fill=(96,116,134,120), width=18, joint="curve")
    # 산맥
    def mtn(x, y, w, h):
        dr.polygon([(x, y), (x+w/2, y-h), (x+w, y)], fill=ink+(120,))
        dr.polygon([(x+w*0.3, y-h*0.55), (x+w*0.42, y-h*0.8), (x+w*0.54, y-h*0.55)], fill=(240,226,191,90))
    for (x, y, w, h) in [(70,250,150,95),(200,280,180,120),(900,230,160,100),(1050,270,150,80),(560,210,160,90)]:
        mtn(x, y, w, h)
    # 숲(점점이 나무)
    for _ in range(120):
        x, y = random.randint(40, W-40), random.randint(int(H*0.62), H-30)
        r = random.randint(5, 10)
        dr.ellipse([x-r, y-r, x+r, y+r], fill=ink+(90,))
        dr.rectangle([x-1, y, x+1, y+r], fill=ink+(90,))
    # 얼룩
    stains = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(stains)
    for _ in range(40):
        x, y = random.randint(0, W), random.randint(0, H); r = random.randint(20, 80)
        sd.ellipse([x-r, y-r, x+r, y+r], fill=(90,66,38,random.randint(8,22)))
    stains = stains.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img, stains)
    img = Image.alpha_composite(img, vignette(170))
    img.convert("RGB").save("assets/bg/map.png")
    print("assets/bg/map.png", img.size)

battlefield()
warmap()
print("done")
