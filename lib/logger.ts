import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Logger leve que append em ./logs/app-YYYY-MM-DD.log + também console.
 *
 * Não bloqueia a request — fire-and-forget. Se write falhar, fallback no
 * console.error pra não engolir o erro silenciosamente.
 *
 * Uso:
 *   import { log } from "@/lib/logger";
 *   log.info("orders.create", { orderId: 42, operator: "Maria" });
 *   log.error("orders.create.fail", err);
 */

type Level = "info" | "warn" | "error";

function logDir(): string {
  return path.join(process.cwd(), "logs");
}

function logFile(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const name = `app-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`;
  return path.join(logDir(), name);
}

let ensureDirPromise: Promise<void> | null = null;
async function ensureDir(): Promise<void> {
  if (!ensureDirPromise) {
    ensureDirPromise = fs.mkdir(logDir(), { recursive: true }).then(() => undefined);
  }
  return ensureDirPromise;
}

async function write(level: Level, tag: string, data: unknown) {
  const ts = new Date().toISOString();
  const serialized = data instanceof Error
    ? `${data.name}: ${data.message}${data.stack ? "\n" + data.stack : ""}`
    : typeof data === "string"
    ? data
    : JSON.stringify(data);
  const line = `[${ts}] [${level.toUpperCase()}] ${tag} ${serialized}\n`;

  // sempre console
  if (level === "error") console.error(line.trimEnd());
  else if (level === "warn") console.warn(line.trimEnd());
  else console.log(line.trimEnd());

  // append em arquivo (fire-and-forget)
  try {
    await ensureDir();
    await fs.appendFile(logFile(), line, "utf8");
  } catch (err) {
    console.error("[logger] falha ao escrever em arquivo:", err);
  }
}

export const log = {
  info: (tag: string, data?: unknown) => {
    void write("info", tag, data ?? "");
  },
  warn: (tag: string, data?: unknown) => {
    void write("warn", tag, data ?? "");
  },
  error: (tag: string, data?: unknown) => {
    void write("error", tag, data ?? "");
  },
};
