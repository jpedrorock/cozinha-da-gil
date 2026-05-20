import { addClient, removeClient } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let clientRef: ReturnType<typeof addClient> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clientRef = addClient(controller);
      controller.enqueue(new TextEncoder().encode(": connected\n\n"));

      pingTimer = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          if (pingTimer) clearInterval(pingTimer);
        }
      }, 25_000);
    },
    cancel() {
      if (clientRef) removeClient(clientRef);
      if (pingTimer) clearInterval(pingTimer);
    },
  });

  request.signal.addEventListener("abort", () => {
    if (clientRef) removeClient(clientRef);
    if (pingTimer) clearInterval(pingTimer);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
