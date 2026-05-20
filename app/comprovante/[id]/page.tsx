import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/orders";
import { ComprovanteClient } from "./ComprovanteClient";

export const dynamic = "force-dynamic";

export default async function ComprovantePage({ params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
  if (Number.isNaN(id)) return notFound();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return notFound();

  return <ComprovanteClient order={serializeOrder(order)} />;
}
