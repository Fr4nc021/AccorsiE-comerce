import type { TipoVeiculoModelo } from "@/features/compatibilidade/constants/tipoVeiculoModelo";
import type { FipeVehicleType } from "@/services/fipe/parallelumClient";

function normalizeNome(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nomes/tokens típicos de picape na FIPE de carros (a API não tem tipo camionete). */
const CAMIONETE_TOKENS = [
  "hilux",
  "ranger",
  "s10",
  "s 10",
  "amarok",
  "strada",
  "saveiro",
  "frontier",
  "toro",
  "montana",
  "oroch",
  "l200",
  "l 200",
  "triton",
  "maverick",
  "rampage",
  "gladiator",
  "silverado",
  "ridgeline",
  "tacoma",
  "tundra",
  "colorado",
  "canyon",
  "alaskan",
  "ram 1500",
  "ram 2500",
  "ram 3500",
  "f250",
  "f 250",
  "f350",
  "f 350",
  "d20",
  "d 20",
  "courier",
] as const;

function looksLikeCamionete(nome: string): boolean {
  const n = ` ${normalizeNome(nome)} `;
  if (/\bpicape\b/.test(n) || /\bpick ?up\b/.test(n)) return true;
  return CAMIONETE_TOKENS.some((token) => n.includes(` ${token} `));
}

/**
 * Tipo interno do catálogo a partir da fonte FIPE + nome do modelo.
 * `trucks` → caminhão; picapes conhecidas em `cars` → camionete; demais carros → carro.
 */
export function classifyTipoVeiculoModelo(
  vehicleType: FipeVehicleType,
  modeloNome: string,
): TipoVeiculoModelo {
  if (vehicleType === "trucks") return "caminhao";
  if (looksLikeCamionete(modeloNome)) return "camionete";
  return "carro";
}
