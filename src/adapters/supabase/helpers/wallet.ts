import { SupabaseClient } from "@supabase/supabase-js";
import { ContextPlugin } from "../../../types/plugin-input";
import { Database } from "../types/database";
import { Super } from "./supabase";

export class Wallet extends Super {
  constructor(supabase: SupabaseClient<Database>, context: ContextPlugin) {
    super(supabase, context);
  }

  async getWalletByUserId(userId: number) {
    const { data, error } = await this.supabase.from("users").select("wallets(*)").eq("id", userId).maybeSingle();
    if (error) {
      this.context.logger.error("Failed to get wallet", { userId, error: error instanceof Error ? error : undefined });
      throw error;
    }

    this.context.logger.info("Successfully fetched wallet", { userId, address: data?.wallets?.address });
    return data?.wallets?.address ?? null;
  }
}
