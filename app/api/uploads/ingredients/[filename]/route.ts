import { NextResponse } from "next/server";
import { readIngredientImage } from "@/lib/uploads";

export const runtime = "nodejs";
// Rota dinâmica (filename varia) — Next lida sozinho com base no Cache-Control.
// `force-dynamic` evita avaliação em build time conflitar com filesystem reads
// (mesma armadilha do /api/uploads/products).
export const dynamic = "force-dynamic";

/**
 * GET /api/uploads/ingredients/[filename]
 *
 * Serve SVG/PNG de ícone de ingrediente salvo no volume.
 * Filename é fingerprintado (hash do conteúdo) → imutável.
 *
 * Cache-Control: 1 ano + immutable. Troca de imagem = novo hash =
 * URL nova, browser baixa de novo.
 */
export async function GET(_request: Request, props: { params: Promise<{ filename: string }> }) {
  const params = await props.params;
  const filename = params.filename;
  const image = await readIngredientImage(filename);
  if (!image) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return new NextResponse(image.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
