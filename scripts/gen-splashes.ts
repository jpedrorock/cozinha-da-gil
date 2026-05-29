/**
 * Gera PNGs de splash screen pra iOS standalone PWA — preenche fundo
 * amarelo do brand (#FFD600) + logo centralizado.
 *
 * Uso: npx tsx scripts/gen-splashes.ts
 *
 * Apenas RECRIA arquivos faltantes em public/splash/. Idempotente.
 *
 * Tamanhos cobrem:
 *   - Todos os iPhones de 6+ até 17 Pro Max
 *   - iPad mini, Air 11"/13", Pro 11"/13"
 *
 * Adicionar device novo: incluir aqui + em IOS_SPLASHES em
 * app/layout.tsx com a media query correta.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = eval("require") as NodeRequire;
const fs = nodeRequire("fs").promises as typeof import("fs").promises;
const path = nodeRequire("path") as typeof import("path");
import sharp from "sharp";

const ROOT = process.cwd();
const SPLASH_DIR = path.join(ROOT, "public", "splash");
const ICON_SRC = path.join(ROOT, "public", "icon-512.png");
const BG = "#FFD600"; // brand-yellow
// Logo ocupa ~25% da menor dimensão do device — proporção típica de splash iOS
const LOGO_RATIO = 0.25;

const SIZES: Array<{ w: number; h: number; device: string }> = [
  // iPhone (já existentes — não regera se arquivo presente)
  { w: 1290, h: 2796, device: "14/15/16/17 Pro Max" },
  { w: 1179, h: 2556, device: "14/15/16/17 Pro" },
  { w: 1170, h: 2532, device: "12/13/14 (não-Pro)" },
  { w: 1284, h: 2778, device: "12/13 Pro Max" },
  { w: 1125, h: 2436, device: "X/XS/11 Pro" },
  { w: 828, h: 1792, device: "XR/11" },
  { w: 750, h: 1334, device: "SE/6/7/8" },
  { w: 1242, h: 2208, device: "6+/7+/8+" },
  // iPhone 17 series (lançados set/2025) — Pro Max ganhou dimensão nova
  { w: 1320, h: 2868, device: "17 Pro Max" },
  // iPad (novos)
  { w: 1488, h: 2266, device: "iPad mini (6ª/7ª)" },
  { w: 1620, h: 2160, device: "iPad 10ª" },
  { w: 1640, h: 2360, device: "iPad Air 11\"" },
  { w: 1668, h: 2388, device: "iPad Pro 11\"" },
  { w: 2048, h: 2732, device: "iPad Air 13\"" },
  { w: 2064, h: 2752, device: "iPad Pro 13\"" },
];

async function main() {
  await fs.mkdir(SPLASH_DIR, { recursive: true });
  let created = 0;
  let skipped = 0;

  // Pré-carrega ícone do brand pra resize ondemand
  const iconBuf = await fs.readFile(ICON_SRC);

  for (const { w, h, device } of SIZES) {
    const filename = `splash-${w}x${h}.png`;
    const outPath = path.join(SPLASH_DIR, filename);
    try {
      await fs.access(outPath);
      skipped++;
      continue; // já existe
    } catch {
      // não existe — gera
    }

    const logoSize = Math.round(Math.min(w, h) * LOGO_RATIO);
    const resizedLogo = await sharp(iconBuf)
      .resize(logoSize, logoSize, { fit: "contain" })
      .toBuffer();

    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: BG,
      },
    })
      .composite([
        {
          input: resizedLogo,
          gravity: "center",
        },
      ])
      .png()
      .toFile(outPath);

    console.log(`✓ ${filename} (${device})`);
    created++;
  }

  console.log(`\nResultado: ${created} criados, ${skipped} já existiam.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
