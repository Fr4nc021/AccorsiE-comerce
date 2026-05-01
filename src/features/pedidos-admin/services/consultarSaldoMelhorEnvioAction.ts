"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ensureMelhorEnvioAccessToken, fetchMelhorEnvioBalance } from "@/services/melhorEnvio";

export type ConsultarSaldoMelhorEnvioState = {
  ok?: boolean;
  error?: string;
  balance?: number;
  reserved?: number;
  debts?: number;
};

export async function consultarSaldoMelhorEnvioAction(
  _prev: ConsultarSaldoMelhorEnvioState | null,
  _formData: FormData,
): Promise<ConsultarSaldoMelhorEnvioState> {
  await requireAdmin();
  try {
    const token = await ensureMelhorEnvioAccessToken();
    const res = await fetchMelhorEnvioBalance(token);
    if (!res.ok) {
      return { error: res.message };
    }
    return {
      ok: true,
      balance: res.balance,
      reserved: res.reserved,
      debts: res.debts,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao consultar saldo.";
    return { error: msg };
  }
}
