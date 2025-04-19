import { SupabaseClient } from "@supabase/supabase-js";
import { ContextPlugin } from "../../../types/plugin-input";
import { Database } from "../types/database";

export class Super {
  protected supabase: SupabaseClient<Database>;
  protected context: ContextPlugin;

  constructor(supabase: SupabaseClient<Database>, context: ContextPlugin) {
    this.supabase = supabase;
    this.context = context;
  }
}
