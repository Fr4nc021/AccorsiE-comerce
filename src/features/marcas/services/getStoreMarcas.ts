import { createClient } from "@/services/supabase/server";

export type StoreMarcaOption = {
  id: string;
  nome: string;
};

export async function getStoreMarcas(): Promise<StoreMarcaOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("marcas").select("id, nome").order("nome");
    if (error || !data) return [];
    return data as StoreMarcaOption[];
  } catch {
    return [];
  }
}
