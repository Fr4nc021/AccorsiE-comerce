import { createClient } from "@/services/supabase/server";
import type { CategoryListItem } from "@/types/category";

export async function getHomeCategories(): Promise<CategoryListItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("categorias").select("id, nome, icone").order("nome");
    if (error || !data) return [];
    return data as CategoryListItem[];
  } catch {
    return [];
  }
}
