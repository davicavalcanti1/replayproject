"""
Extrai a silhueta do logo R (icon site.png) e gera um PNG preto/branco
limpo que o OpenSCAD consegue ler via surface() como heightmap.
"""
from PIL import Image, ImageFilter
import numpy as np
import os

SRC = r"C:\Users\DELL\Desktop\logo site\icon site.png"
OUT = r"C:\Users\DELL\Desktop\replay_mvp\3d-case\reframe_r.png"

SIZE = 220           # resolução final (pixels). Mais = mais detalhe
THRESHOLD = 60       # pixels > isso são considerados "logo" (fundo escuro)
MARGIN = 8           # margem em pixels ao redor do R no PNG final

# 1. carrega e converte
img = Image.open(SRC).convert("L")
arr = np.array(img)

# 2. threshold
mask = (arr > THRESHOLD).astype(np.uint8) * 255

# 3. recorta no bounding box do R
rows = np.any(mask > 0, axis=1)
cols = np.any(mask > 0, axis=0)
if not rows.any() or not cols.any():
    raise RuntimeError("Nada encontrado no threshold — ajuste THRESHOLD")
r0, r1 = np.where(rows)[0][[0, -1]]
c0, c1 = np.where(cols)[0][[0, -1]]
crop = mask[r0:r1 + 1, c0:c1 + 1]

# 4. redimensiona preservando proporção; encaixa num quadrado SIZE x SIZE
h, w = crop.shape
scale = (SIZE - 2 * MARGIN) / max(h, w)
new_h, new_w = int(h * scale), int(w * scale)
pil_crop = Image.fromarray(crop).resize((new_w, new_h), Image.LANCZOS)

# 5. cola centralizado num canvas preto SIZE x SIZE
canvas = Image.new("L", (SIZE, SIZE), 0)
off_x = (SIZE - new_w) // 2
off_y = (SIZE - new_h) // 2
canvas.paste(pil_crop, (off_x, off_y))

# 6. suaviza um pouquinho e re-threshold pra eliminar serrilhado
canvas = canvas.filter(ImageFilter.GaussianBlur(radius=0.8))
final_arr = np.array(canvas)
final_arr = np.where(final_arr > 100, 255, 0).astype(np.uint8)

# 7. salva
Image.fromarray(final_arr, mode="L").save(OUT)
print(f"OK: {OUT}")
print(f"dim: {SIZE}x{SIZE}  pixels ativos: {(final_arr > 0).sum()}")
