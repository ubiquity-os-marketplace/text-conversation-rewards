import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { Value } from "@sinclair/typebox/value";
import {
  ContributorRoleType,
  EventIncentivesConfiguration,
  eventIncentivesConfigurationType,
} from "../configuration/event-incentives-config";
import { getUserRewardRole, RewardUserRole } from "../helpers/permissions";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";

/**
 * Maps internal reward roles to the config contributor role names.
 */
const REWARD_ROLE_TO_CONTRIBUTOR_ROLE: Record<RewardUserRole, ContributorRoleType> = {
  admin: "COLLABORATOR",
  collaborator: "COLLABORATOR",
  contributor: "CONTRIBUTOR",
  billing_manager: "COLLABORATOR",
};

export class EventIncentivesModule extends BaseModule {
  readonly _configuration: EventIncentivesConfiguration | null = this.context.config.incentives.eventIncentives;

  constructor(context: ContextPlugin) {
    super(context);
  }

  get enabled(): boolean {
    if (!Value.Check(eventIncentivesConfigurationType, this.context.config.incentives.eventIncentives)) {
      this.context.logger.warn(
        "The configuration for the module EventIncentivesModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }

  /**
   * Resolves the contributor role for a user based on the issue context.
   * Returns ISSUER, ASSIGNEE, COLLABORATOR, or CONTRIBUTOR.
   */
  _resolveContributorRole(
    username: string,
    data: Readonly<IssueActivity>,
    roleCache: Map<string, ContributorRoleType>
  ): ContributorRoleType {
    const cached = roleCache.get(username);
    if (cached) {
      return cached;
    }

    // Check if user is the issue author (ISSUER)
    if (data.self?.user?.login === username) {
      const role: ContributorRoleType = "ISSUER";
      roleCache.set(username, role);
      return role;
    }

    // Check if user is an assignee (ASSIGNEE)
    const assignees = data.self?.assignees ?? [];
    const isAssignee = assignees.some((assignee) => assignee?.login === username);
    if (isAssignee) {
      const role: ContributorRoleType = "ASSIGNEE";
      roleCache.set(username, role);
      return role;
    }

    // Check linked PR authors
    const isPrAuthor = data.linkedMergedPullRequests.some(
      (pull) => pull.self?.user?.login === username
    );
    if (isPrAuthor && isAssignee === undefined) {
      // PR author who is also an assignee would have been caught above
      // But if they are a PR author and assignee, they're ASSIGNEE
    }

    // For non-issuer, non-assignee: we'll resolve async later
    // Default to CONTRIBUTOR, will be refined in _resolveContributorRolesAsync
    const role: ContributorRoleType = "CONTRIBUTOR";
    roleCache.set(username, role);
    return role;
  }

  /**
   * Async version that checks org/repo membership for accurate role resolution.
   */
  async _resolveContributorRolesAsync(
    usernames: string[],
    data: Readonly<IssueActivity>,
    roleCache: Map<string, ContributorRoleType>
  ): Promise<void> {
    for (const username of usernames) {
      if (roleCache.get(username) !== "CONTRIBUTOR") {
        continue; // Already resolved as ISSUER, ASSIGNEE, or explicitly set
      }

      // Check if user is a linked PR author (ASSIGNEE-equivalent if linked)
      const isPrAuthor = data.linkedMergedPullRequests.some(
        (pull) => pull.self?.user?.login === username
      );

      try {
        const rewardRole = await getUserRewardRole(this.context, username);
        const contributorRole = REWARD_ROLE_TO_CONTRIBUTOR_ROLE[rewardRole];

        // If the user is a PR author, they count as ASSIGNEE in pull context
        // but their org role in issue context
        if (isPrAuthor && contributorRole === "CONTRIBUTOR") {
          // PR author who is not a collaborator - they're still a contributor
          // but might be an assignee-equivalent
          roleCache.set(username, "CONTRIBUTOR");
        } else {
          roleCache.set(username, contributorRole);
        }
      } catch {
        roleCache.set(username, "CONTRIBUTOR");
      }
    }
  }

  /**
   * Looks up the reward value for a given event key and contributor role from the config.
   * Supports both the `events` shorthand and the full webhook-style config.
   */
  _getRewardForEvent(eventName: string, role: ContributorRoleType): number {
    if (!this._configuration) {
      return 0;
    }

    // Check the events shorthand first
    if (this._configuration.events && this._configuration.events[eventName]) {
      const eventConfig = this._configuration.events[eventName];
      if (eventConfig.targets.includes(role)) {
        return eventConfig.value;
      }
      return 0;
    }

    // Parse the event name to match against webhook-style config
    // e.g., "issue.labeled" -> prefix="issue", action="labeled"
    // e.g., "pull_request.commented" -> prefix="pull_request", action="commented"
    const parts = eventName.split(".");
    if (parts.length < 2) {
      return 0;
    }

    const prefix = parts[0]; // "issue" or "pull_request"
    const action = parts[parts.length - 1]; // the action part

    // Map prefix to config section and context key
    const contextKey = prefix === "pull_request" ? "pull" : "issue";

    // Try to find the matching config section
    // Handle nested events like "pull_request.reviewed.approved"
    if (parts.length >= 3) {
      // e.g., pull_request.reviewed.approved or issue.received.review_requested
      const middleParts = parts.slice(1, -1);
      const fullAction = middleParts.concat([action]).join("_");
      return this._lookupWebhookConfig(fullAction, contextKey, role);
    }

    return this._lookupWebhookConfig(action, contextKey, role);
  }

  private _lookupWebhookConfig(action: string, contextKey: string, role: ContributorRoleType): number {
    if (!this._configuration) {
      return 0;
    }

    // Check common webhook event sections
    const sections = [
      "pull_request",
      "pull_request_review",
      "pull_request_review_comment",
      "pull_request_review_thread",
      "issue_comment",
      "commit_comment",
      "workflow_run",
      "check_run",
      "check_suite",
    ] as const;

    for (const section of sections) {
      const sectionConfig = this._configuration[section];
      if (sectionConfig && typeof sectionConfig === "object" && action in sectionConfig) {
        const actionConfig = (sectionConfig as Record<string, unknown>)[action];
        if (actionConfig && typeof actionConfig === "object") {
          const contextConfig = (actionConfig as Record<string, unknown>)[contextKey];
          if (contextConfig && typeof contextConfig === "object") {
            const targets = (contextConfig as { targets?: string[] }).targets;
            const value = (contextConfig as { value?: number }).value;
            if (targets && Array.isArray(targets) && targets.includes(role)) {
              return value ?? 0;
            }
          }
        }
      }
    }

    return 0;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const { octokit } = this.context;
    if (!data.self?.user) {
      return result;
    }
    const { owner, repo, issue_number } = parseGitHubUrl(data.self.html_url);

    const issueTimelineEvents = await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
      owner: owner,
      repo: repo,
      issue_number: issue_number,
      per_page: 100,
    });
    const issueReactions = await octokit.paginate(octokit.rest.reactions.listForIssue, {
      owner: owner,
      repo: repo,
      issue_number: issue_number,
      per_page: 100,
    });
    const issueComments = data.comments;

    for (const username of Object.keys(result)) {
      result[username].events = {};
    }

    this.processEvents("issue", issueTimelineEvents, result);
    this.processReactions(data.self.user.login, issueReactions, result);

    const filteredComments = issueComments.filter(
      (comment) => comment.user?.type === "User" && (comment.reactions?.total_count ?? 0) > 0
    );
    for (const comment of filteredComments) {
      const issueCommentReactions = await octokit.paginate(octokit.rest.reactions.listForIssueComment, {
        owner: owner,
        repo: repo,
        comment_id: comment.id,
        per_page: 100,
      });
      this.processReactions(comment.user?.login, issueCommentReactions, result);
    }

    for (const pull of data.linkedMergedPullRequests) {
      if (!pull.self) {
        continue;
      }
      const pullTimelineEvents = await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
        owner: pull.self.base.repo.owner.login,
        repo: pull.self.base.repo.name,
        issue_number: pull.self.number,
        per_page: 100,
      });
      this.processEvents("pull_request", pullTimelineEvents, result);

      const filteredPrComments =
        pull.comments?.filter(
          (comment) => comment.user?.type === "User" && (comment.reactions?.total_count ?? 0) > 0
        ) ?? [];

      for (const comment of filteredPrComments) {
        const pullCommentReactions = await octokit.paginate(octokit.rest.reactions.listForIssueComment, {
          owner: pull.self.base.repo.owner.login,
          repo: pull.self.base.repo.name,
          comment_id: comment.id,
          per_page: 100,
        });
        this.processReactions(comment.user?.login, pullCommentReactions, result);
      }

      const filteredReviewComments = pull.reviewComments?.filter((comment) => comment.user.type === "User") ?? [];
      for (const reviewComment of filteredReviewComments) {
        this.increaseEventCount(result, reviewComment.user.login, "pull_request.review_comment");
        if ((reviewComment.reactions?.total_count ?? 0) === 0) {
          continue;
        }
        const reviewReactions = await octokit.paginate(octokit.rest.reactions.listForPullRequestReviewComment, {
          owner: pull.self.base.repo.owner.login,
          repo: pull.self.base.repo.name,
          pull_number: pull.self.number,
          comment_id: reviewComment.id,
          per_page: 100,
        });
        this.processReactions(reviewComment.user.login, reviewReactions, result);
      }
    }

    // Apply reward calculation based on config and user roles
    await this._applyEventRewards(data, result);

    return result;
  }

  /**
   * After all events are counted, calculate rewards based on the config
   * and each user's contributor role.
   */
  async _applyEventRewards(data: Readonly<IssueActivity>, result: Result): Promise<void> {
    if (!this._configuration) {
      return;
    }

    const roleCache = new Map<string, ContributorRoleType>();
    const usernames = Object.keys(result);

    // First pass: resolve roles synchronously for known roles
    for (const username of usernames) {
      this._resolveContributorRole(username, data, roleCache);
    }

    // Second pass: resolve remaining roles asynchronously
    await this._resolveContributorRolesAsync(usernames, data, roleCache);

    // Calculate rewards for each user's events
    for (const username of usernames) {
      const userResult = result[username];
      if (!userResult.events) {
        continue;
      }

      const role = roleCache.get(username) ?? "CONTRIBUTOR";
      let totalEventReward = 0;

      for (const [eventName, eventData] of Object.entries(userResult.events)) {
        const rewardPerEvent = this._getRewardForEvent(eventName, role);
        const reward = eventData.count * rewardPerEvent;
        eventData.reward = reward;
        totalEventReward += reward;
      }

      // Add event rewards to user's result
      if (totalEventReward > 0) {
        result[username].eventIncentives = {
          reward: totalEventReward,
        };
      }
    }
  }

  processEvents(
    prefix: "pull_request" | "issue",
    timelineEvents: RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"],
    result: Result
  ) {
    timelineEvents.forEach((ev) => {
      if (ev.event === "reviewed" && "user" in ev && "state" in ev) {
        this.increaseEventCount(result, ev.user.login, `${prefix}.${ev.event}.${ev.state}`);
      } else if (ev.event === "commented" && "user" in ev) {
        this.increaseEventCount(result, ev.user.login, `${prefix}.${ev.event}`);
      } else if (
        ev.event === "review_requested" &&
        "requested_reviewer" in ev &&
        ev.requested_reviewer &&
        "review_requester" in ev
      ) {
        this.increaseEventCount(result, ev.requested_reviewer.login, `${prefix}.received.${ev.event}`);
        this.increaseEventCount(result, ev.review_requester.login, `${prefix}.sent.${ev.event}`);
      } else if ("actor" in ev && ev.actor && ev.actor.type !== "Bot") {
        this.increaseEventCount(result, ev.actor.login, `${prefix}.${ev.event}`);
      }
    });
  }

  processReactions(
    author: string | undefined,
    reactions: RestEndpointMethodTypes["reactions"]["listForIssue"]["response"]["data"],
    result: Result
  ) {
    reactions.forEach((reaction) => {
      if (reaction.user) {
        this.increaseEventCount(result, reaction.user.login, `reaction.sent.${reaction.content}`);
      }
      if (author) {
        this.increaseEventCount(result, author, `reaction.received.${reaction.content}`);
      }
    });
  }

  increaseEventCount(result: Result, username: string, eventName: string) {
    if (!result[username]) {
      return;
    }
    if (!result[username].events) {
      result[username].events = {};
    }
    if (!result[username].events[eventName]) {
      result[username].events[eventName] = {
        count: 1,
        reward: 0,
      };
    } else {
      result[username].events[eventName].count += 1;
    }
  }
}
