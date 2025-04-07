import { SupabaseClient } from "@supabase/supabase-js";
import { ContextPlugin } from "../types/plugin-input";
import { Super } from "./supabase/helpers/supabase";
import { Wallet } from "./supabase/helpers/wallet";
import { Database } from "./supabase/types/database";

export function createAdapters(supabaseClient: SupabaseClient<Database>, context: ContextPlugin) {
  return {
    supabase: {
      wallet: new Wallet(supabaseClient, context),
      super: new Super(supabaseClient, context),
    },
  };
}

export * from "./supabase/types/database";
