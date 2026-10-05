import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const KEY = "FIPE_SUBSCRIPTION_TOKEN";

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

function readTokenFromFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const value = parseValueFromLine(line);
      if (value) return value;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Fallback só de desenvolvimento. Em produção o Next/Vercel já injeta `process.env`.
 * `loadEnvConfig(process.cwd())` e `join(process.cwd(), nomeDinamico)` fazem o file
 * tracer incluir o projeto inteiro na função serverless (estoura o limite de 250 MB).
 * O comentário turbopackIgnore evita esse rastreio mesmo neste fallback.
 */
function readTokenFromDevEnvFiles(): string {
  const envLocal = join(/*turbopackIgnore: true*/ process.cwd(), ".env.local");
  const envFile = join(/*turbopackIgnore: true*/ process.cwd(), ".env");
  return readTokenFromFile(envLocal) ?? readTokenFromFile(envFile) ?? "";
}

/**
 * Token FIPE para rotas de API.
 * Produção: somente `process.env.FIPE_SUBSCRIPTION_TOKEN`.
 * Desenvolvimento: se a variável não veio no ambiente, lê `.env.local` e `.env`.
 */
export function getFipeSubscriptionToken(): string {
  const fromEnv = process.env[KEY]?.trim() ?? "";
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "";
  return readTokenFromDevEnvFiles();
}
