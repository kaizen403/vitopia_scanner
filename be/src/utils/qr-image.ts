import QRCode from "qrcode";
import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, "../assets/vitopia.png");

const BG_COLOR   = "#0A0A0A";
const MODULE_PX  = 22;   // pixels per QR module
const DOT_RADIUS = 6;    // rounded corner radius

// Red → orange gradient (pulled from VITopia logo palette)
const GRAD_START = { r: 230, g: 30,  b: 10  };
const GRAD_END   = { r: 255, g: 160, b: 0   };

// Logo occupies 28% of QR width — safe with ERROR_CORRECT_H (30% damage tolerance)
const LOGO_RATIO = 0.28;

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function gradColorHex(col: number, row: number, size: number): string {
  const t = (col + row) / (2 * (size - 1));
  const r = Math.round(GRAD_START.r + (GRAD_END.r - GRAD_START.r) * t);
  const g = Math.round(GRAD_START.g + (GRAD_END.g - GRAD_START.g) * t);
  const b = Math.round(GRAD_START.b + (GRAD_END.b - GRAD_START.b) * t);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extract the boolean module matrix from the QR token.
 * Uses qrcode.toString(svg) then sharp to rasterise at 1px/module
 * so we can read which cells are dark.
 */
async function getModuleMatrix(token: string): Promise<boolean[][]> {
  const svgStr = await QRCode.toString(token, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
  } as Parameters<typeof QRCode.toString>[1]);

  // Parse the declared grid size from the SVG viewBox
  const match = svgStr.match(/viewBox="0 0 (\d+) \d+"/);
  const gridSize = match ? parseInt(match[1]) : 33;

  // Rasterise at exactly 1px per module
  const raw = await sharp(Buffer.from(svgStr))
    .resize(gridSize, gridSize, { fit: "fill", kernel: "nearest" })
    .greyscale()
    .raw()
    .toBuffer();

  const modules: boolean[][] = [];
  for (let r = 0; r < gridSize; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < gridSize; c++) {
      row.push(raw[r * gridSize + c] < 128); // dark pixel = module ON
    }
    modules.push(row);
  }
  return modules;
}

/**
 * Generates a styled VITopia QR code PNG buffer.
 *
 * The encoded token (HMAC data) is identical to the plain QR —
 * only the visual rendering changes. Auth & scan logic are untouched.
 */
export async function generateStyledQRImage(qrToken: string): Promise<Buffer> {
  const modules = await getModuleMatrix(qrToken);
  const size = modules.length;
  const imgPx = size * MODULE_PX;

  // ── Logo: resize preserving aspect ratio, strip near-black background ──
  const logoRaw = readFileSync(LOGO_PATH);
  const logoMeta = await sharp(logoRaw).metadata();
  const origW = logoMeta.width ?? 400;
  const origH = logoMeta.height ?? 300;
  const maxLogoW = Math.floor(imgPx * LOGO_RATIO);
  const scale = maxLogoW / origW;
  const logoW = Math.floor(origW * scale);
  const logoH = Math.floor(origH * scale);

  const { data: logoPixels } = await sharp(logoRaw)
    .resize(logoW, logoH, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Make near-black pixels transparent so logo blends into dark BG
  for (let i = 0; i < logoPixels.length; i += 4) {
    const maxCh = Math.max(logoPixels[i], logoPixels[i + 1], logoPixels[i + 2]);
    if (maxCh < 35) {
      const alpha = Math.max(0, Math.min(255, ((maxCh - 15) / 20) * 255));
      logoPixels[i + 3] = Math.floor((logoPixels[i + 3] / 255) * alpha);
    }
  }

  const logoPng = await sharp(logoPixels, {
    raw: { width: logoW, height: logoH, channels: 4 },
  })
    .png()
    .toBuffer();

  // Logo center position in pixels
  const bx = Math.floor((imgPx - logoW) / 2);
  const by = Math.floor((imgPx - logoH) / 2);

  // Module range to leave empty under logo (+ 1 module breathing room)
  const pad = 1;
  const colS = Math.max(0, Math.floor(bx / MODULE_PX) - pad);
  const colE = Math.min(size, Math.ceil((bx + logoW) / MODULE_PX) + pad);
  const rowS = Math.max(0, Math.floor(by / MODULE_PX) - pad);
  const rowE = Math.min(size, Math.ceil((by + logoH) / MODULE_PX) + pad);

  // ── Build SVG with rounded-square gradient dots ──
  const rects: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules[row][col]) continue;
      if (row >= rowS && row < rowE && col >= colS && col < colE) continue;

      const x = col * MODULE_PX + 1;
      const y = row * MODULE_PX + 1;
      const s = MODULE_PX - 2;
      const fill = gradColorHex(col, row, size);
      rects.push(
        `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${DOT_RADIUS}" ry="${DOT_RADIUS}" fill="${fill}"/>`
      );
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imgPx}" height="${imgPx}">`,
    `<rect width="${imgPx}" height="${imgPx}" fill="${BG_COLOR}"/>`,
    ...rects,
    `</svg>`,
  ].join("\n");

  // ── Render SVG → PNG, composite logo on top ──
  const basePng = await sharp(Buffer.from(svg)).png().toBuffer();

  return sharp(basePng)
    .composite([{ input: logoPng, left: bx, top: by, blend: "over" }])
    .png()
    .toBuffer();
}

/** Returns a base64 data URL of the styled QR PNG (for email attachments). */
export async function generateStyledQRDataUrl(qrToken: string): Promise<string> {
  const buf = await generateStyledQRImage(qrToken);
  return `data:image/png;base64,${buf.toString("base64")}`;
}
