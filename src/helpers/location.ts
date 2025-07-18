import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../adapters";
import { ContextPlugin } from "../types/plugin-input";
import { getRepo, parseGitHubUrl } from "../start";
import { Super } from "../adapters/supabase/helpers/supabase";

export class Location extends Super {
  locationId: number | null = null;

  constructor(supabase: SupabaseClient<Database>, context: ContextPlugin) {
    super(supabase, context);
  }

  /*
   * Will update the location based on the last created location row
   */
  public async upsert(locationData: Database["public"]["Tables"]["locations"]["Insert"]) {
    if (this.locationId) {
      const { data, error } = await this.supabase
        .from("locations")
        .update(locationData)
        .match({ id: this.locationId })
        .select()
        .single();

      if (error || !data) {
        throw this.context.logger.error("Failed to update location", { err: error, locationData });
      }

      return data;
    } else {
      const { data, error } = await this.supabase.from("locations").insert(locationData).select().single();

      if (error || !data) {
        throw this.context.logger.error("Failed to insert location", { err: error, locationData });
      }

      this.locationId = data.id;
      return data;
    }
  }

  // Refer to https://github.com/ubiquity-os-marketplace/command-wallet/pull/51
  public async getOrCreateIssueLocation(issue: { issueId: number; issueUrl: string }) {
    let locationId: number | null = null;

    const { data: locationData } = await this.supabase
      .from("locations")
      .select("id")
      .eq("issue_id", issue.issueId)
      .eq("node_url", issue.issueUrl)
      .single();

    if (!locationData) {
      const issueItem = await getRepo(this.context, parseGitHubUrl(issue.issueUrl));
      const { data: newLocationData, error } = await this.supabase
        .from("locations")
        .insert({
          node_url: issue.issueUrl,
          issue_id: issue.issueId,
          node_type: "Issue",
          repository_id: issueItem.id,
        })
        .select("id")
        .single();
      if (!newLocationData || error) {
        this.context.logger.error("Failed to create a new location", error);
      } else {
        locationId = newLocationData.id;
        this.locationId = locationId;
      }
    } else {
      locationId = locationData.id;
    }
    if (!locationId) {
      throw this.context.logger.error("Failed to retrieve the related location from issue", { issue });
    }
    return locationId;
  }
}
