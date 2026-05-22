import { NextResponse } from "next/server";
import { readProductImage } from "@/lib/uploads";

export const runtime = "nodejs";
// Rota dinâmica (filename varia) — Next lida sozinho com base no Cache-Control
// que devolvemos. `force-static` tava forçando avaliação em build time o que
// confunde com filesystem reads. Cache real fica no CDN/browser via header.
export const dynamic = "force-dynamic";

/**
 * GET /api/uploads/products/[filename]
 *
 * Serve imagens de produto guardadas no volume (fora de public/).
 * Filename já é fingerprintado (productId-hash.ext) → imutável.
 *
 * Cache-Control: 1 ano + immutable. Quando admin troca imagem, o filename
 * vira outro hash, então URL muda e browser baixa de novo.
 */
export async function GET(
  _request: Request,
  { params }: { params: { filename: string } },
) {
  const filename = params.filename;
  const image = await readProductImage(filename);
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
