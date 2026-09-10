"""Genera favicons con fondo blanco circular + borde negro desde el logo PPC.
Deja intactos apple-touch-icon y android-chrome (íconos de instalación)."""
from PIL import Image, ImageDraw

SRC = "public/ppc-logo.png"

def make_favicon(size, out, border_ratio=0.06):
    # Lienzo cuadrado transparente a alta resolución (supersampling x4)
    ss = size * 4
    canvas = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    border = max(1, int(ss * border_ratio))
    # Círculo blanco con borde negro
    draw.ellipse(
        [border // 2, border // 2, ss - border // 2 - 1, ss - border // 2 - 1],
        fill=(255, 255, 255, 255),
        outline=(20, 20, 20, 255),
        width=border,
    )

    # Cargar logo y encajarlo dentro del círculo (padding mínimo para que el
    # vaso central se aprecie en tamaños chicos)
    logo = Image.open(SRC).convert("RGBA")
    pad = int(ss * 0.02)
    target = ss - pad * 2
    lw, lh = logo.size
    scale = min(target / lw, target / lh)
    new = (max(1, int(lw * scale)), max(1, int(lh * scale)))
    logo = logo.resize(new, Image.LANCZOS)

    # Máscara circular para recortar el logo al círculo interior
    ox = (ss - new[0]) // 2
    oy = (ss - new[1]) // 2
    canvas.alpha_composite(logo, (ox, oy))

    # Recorte circular final (por si el logo se sale del círculo)
    mask = Image.new("L", (ss, ss), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, ss - 1, ss - 1], fill=255)
    out_img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    out_img.paste(canvas, (0, 0), mask)

    out_img = out_img.resize((size, size), Image.LANCZOS)
    out_img.save(out)
    print("wrote", out, size)

for s, name in [(16, "public/favicon-16x16.png"),
                (32, "public/favicon-32x32.png"),
                (48, "public/favicon-48x48.png"),
                (180, "public/favicon-preview.png")]:
    # borde exterior delgado (el logo ya trae su propio borde de pelota)
    make_favicon(s, name, 0.03)
