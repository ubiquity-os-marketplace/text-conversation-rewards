import { SupabaseClient } from "@supabase/supabase-js";
import { ContextPlugin } from "../types/plugin-input";
import { Super } from "./supabase/helpers/supabase";
import { Wallet } from "./supabase/helpers/wallet";
import { Database } from "./supabase/types/database";
import { Location } from "../helpers/location";
import { TaskAdapter, TaskAdapterConstructor } from "./types/task-adapter";
import { GitHubAdapter } from "./github/adapter";
import { AsanaAdapter } from "./asana/adapter";

export * from "./supabase/types/database";
export * from "./types/task-adapter";
export { GitHubAdapter } from "./github/adapter";
export { AsanaAdapter } from "./asana/adapter";

export function createAdapters(supabaseClient: SupabaseClient<Database>, context: ContextPlugin) {
  return {
    supabase: {
      wallet: new Wallet(supabaseClient, context),
      super: new Super(supabaseClient, context),
      location: new Location(supabaseClient, context),
    },
  };
}

/**
 * Factory function to create the appropriate task adapter based on configuration
 */
export function createTaskAdapter(
  context: ContextPlugin,
  config: {
    platform: "github" | "asana" | string;
    asanaAccessToken?: string;
    asanaWorkspaceGid?: string;
    asanaProjectGid?: string;
  }
): TaskAdapter {
  switch (config.platform) {
    case "asana":
      if (!config.asanaAccessToken) {
        throw new Error("Asana access token is required for Asana adapter");
      }
      return new AsanaAdapter({
        accessToken: config.asanaAccessToken,
        workspaceGid: config.asanaWorkspaceGid ?? "",
        projectGid: config.asanaProjectGid,
      });
    case "github":
    default:
      return new GitHubAdapter(context);
  }
}

/**
 * Registry of available task adapters
 */
export const taskAdapterRegistry: Record<string, TaskAdapterConstructor> = {
  github: GitHubAdapter as unknown as TaskAdapterConstructor,
  asana: AsanaAdapter as unknown as TaskAdapterConstructor,
};
