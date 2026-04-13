export type ParsedCompatRow = {
  modelo_id: string;
  ano_inicio: number;
  ano_fim: number;
};

export type ParseCompatResult =
  | { ok: true; rows: ParsedCompatRow[] }
  | { ok: false; message: string };

/** Lê o JSON enviado pelo fieldset de compatibilidade (várias linhas). */
export function parseCompatibilidadesJson(raw: string): ParseCompatResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, rows: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, message: "Formato inválido na compatibilidade. Recarregue a página e tente de novo." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, message: "Compatibilidade inválida: esperado uma lista de linhas." };
  }

  const out: ParsedCompatRow[] = [];
  const seenModelo = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (item == null || typeof item !== "object") {
      return { ok: false, message: `Linha ${i + 1} da compatibilidade está inválida.` };
    }
    const o = item as Record<string, unknown>;
    const modelo_id = String(o.modelo_id ?? "").trim();
    const ano_inicio_s = String(o.ano_inicio ?? "").trim();
    const ano_fim_s = String(o.ano_fim ?? "").trim();

    if (!modelo_id && !ano_inicio_s && !ano_fim_s) {
      continue;
    }

    if (!modelo_id || !ano_inicio_s || !ano_fim_s) {
      return {
        ok: false,
        message: `Na linha ${i + 1}: com modelo escolhido, preencha ano inicial e final (ou deixe a linha toda vazia).`,
      };
    }

    const ano_inicio = Number.parseInt(ano_inicio_s, 10);
    const ano_fim = Number.parseInt(ano_fim_s, 10);
    if (Number.isNaN(ano_inicio) || Number.isNaN(ano_fim)) {
      return { ok: false, message: `Na linha ${i + 1}: anos devem ser números inteiros.` };
    }
    if (ano_inicio < 1900 || ano_inicio > 2100 || ano_fim < 1900 || ano_fim > 2100) {
      return { ok: false, message: `Na linha ${i + 1}: os anos devem ficar entre 1900 e 2100.` };
    }
    if (ano_inicio > ano_fim) {
      return { ok: false, message: `Na linha ${i + 1}: o ano inicial não pode ser maior que o ano final.` };
    }

    if (seenModelo.has(modelo_id)) {
      return {
        ok: false,
        message: "Cada modelo só pode aparecer uma vez na compatibilidade. Remova duplicatas ou unifique os anos.",
      };
    }
    seenModelo.add(modelo_id);
    out.push({ modelo_id, ano_inicio, ano_fim });
  }

  return { ok: true, rows: out };
}
