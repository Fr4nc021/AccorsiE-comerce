"use client";

import { useActionState, useMemo } from "react";

import {
  consultarSaldoMelhorEnvioAction,
  type ConsultarSaldoMelhorEnvioState,
} from "@/features/pedidos-admin/services/consultarSaldoMelhorEnvioAction";

function formatBrl(n: number): string {
  try {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return String(n);
  }
}

const btnClass =
  "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-60";

export function MelhorEnvioSaldoPanel({
  initial,
  initialError,
}: {
  initial: { balance: number; reserved: number; debts: number } | null;
  initialError: string | null;
}) {
  const initialState = useMemo((): ConsultarSaldoMelhorEnvioState | null => {
    if (initialError) return { error: initialError };
    if (initial) {
      return {
        ok: true,
        balance: initial.balance,
        reserved: initial.reserved,
        debts: initial.debts,
      };
    }
    return null;
  }, [initial, initialError]);

  const [state, formAction, pending] = useActionState<
    ConsultarSaldoMelhorEnvioState | null,
    FormData
  >(consultarSaldoMelhorEnvioAction, initialState);

  const display = state ?? initialState;

  return (
    <div className="mb-6 rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Melhor Envio — saldo</h3>
        <form action={formAction}>
          <button type="submit" disabled={pending} className={btnClass}>
            {pending ? "Atualizando…" : "Atualizar saldo"}
          </button>
        </form>
      </div>
      {display?.error ? (
        <p className="mt-2 text-xs text-red-800">{display.error}</p>
      ) : display?.ok ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-600">Disponível</dt>
            <dd className="font-semibold tabular-nums text-gray-900">
              {formatBrl(display.balance ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">Reservado</dt>
            <dd className="tabular-nums text-gray-800">{formatBrl(display.reserved ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">Débitos (API)</dt>
            <dd className="tabular-nums text-gray-800">{formatBrl(display.debts ?? 0)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-gray-600">Use &quot;Atualizar saldo&quot; para consultar a carteira.</p>
      )}
    </div>
  );
}
