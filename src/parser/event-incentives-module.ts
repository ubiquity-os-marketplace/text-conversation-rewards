import { RestEndpointMethodTypes } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import {
  EventIncentivesConfiguration,
  eventIncentivesConfigurationType,
} from "../configuration/event-incentives-config";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";

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

    return result;
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
    } else if (!result[username].events?.[eventName]) {
      result[username].events[eventName] = {
        count: 1,
        reward: 0,
      };
    } else {
      result[username].events[eventName].count += 1;
    }
  }
}
