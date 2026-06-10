/**
 * Scheduler de backup diário do dev.db.
 *
 * Estratégia: setTimeout pra próximo 03:00 (horário local), depois
 * setInterval de 24h. Roda dentro do processo do Next.js (single
 * container do Coolify — sem multi-instance).
 *
 * Roda APENAS quando habilitado via env var `BACKUP_SCHEDULE_ENABLED=true`.
 * Default: desabilitado em dev pra não criar lixo local.
 *
 * Em caso de crash do scheduler, o backup só não roda — a operação
 * principal do app não é afetada. Falhas são logadas mas não propagam.
 */

import { runBackup } from "@/scripts/backup-db";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Calcula ms até o próximo HH:00 (default 03:00). */
function msUntilNextHour(targetHour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

let scheduled = false;

export function startBackupScheduler() {
  if (scheduled) {
    console.log("[backup] scheduler já rodando — ignorando segundo start");
    return;
  }
  if (process.env.BACKUP_SCHEDULE_ENABLED !== "true") {
    console.log("[backup] scheduler desabilitado (BACKUP_SCHEDULE_ENABLED != true)");
    return;
  }
  scheduled = true;

  const targetHour = Number(process.env.BACKUP_HOUR ?? "3");
  const firstDelay = msUntilNextHour(targetHour);

  const hoursUntil = (firstDelay / (60 * 60 * 1000)).toFixed(1);
  console.log(
    `[backup] scheduler ativo — primeiro backup em ${hoursUntil}h (alvo: ${targetHour}:00)`,
  );

  function tick() {
    runBackup()
      .then((r) => {
        console.log(
          `[backup] OK: ${r.destPath} (${(r.sizeBytes / 1024).toFixed(1)} KB, pruned=${r.prunedCount})`,
        );
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[backup] FALHA: ${msg}`);
      });
  }

  setTimeout(() => {
    tick();
    setInterval(tick, ONE_DAY_MS);
  }, firstDelay);
}
