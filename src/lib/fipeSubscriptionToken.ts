import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

const KEY = "FIPE_SUBSCRIPTION_TOKEN";

let didLoadNextEnv = false;

function ensureNextEnvLoaded(): void {
  if (didLoadNextEnv) return;
  loadEnvConfig(process.cwd());
  didLoadNextEnv = true;
}

function parseValueFromLine(line: string): string | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const body = t.startsWith("export ") ? t.slice("export ".length).trim() : t;
  const re = new RegExp(`^${KEY}\\s*=\\s*(.*)$`);
  const m = body.match(re);
  if (!m) return null;
  let val = m[1]?.trim() ?? "";
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return val.length > 0 ? val : null;
}

/**
 * Token FIPE para rotas de API. Usa `process.env` após `loadEnvConfig`; se vazio, lê `.env.local` / `.env` no `cwd`
 * (fallback para ambientes em que o Next não injeta a variável nas Route Handlers).
 */
export function getFipeSubscriptionToken(): string {
  ensureNextEnvLoaded();
  const fromEnv = process.env[KEY]?.trim() ?? "";
  if (fromEnv) return fromEnv;

  const root = process.cwd();
  for (const name of [".env.local", ".env"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const v = parseValueFromLine(line);
        if (v) return v;
      }
    } catch {
      /* ignore */
    }
  }

  return "";
}
