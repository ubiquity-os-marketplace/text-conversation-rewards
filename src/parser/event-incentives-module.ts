import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import { RestEndpointMethodTypes } from "@octokit/rest";

export class EventIncentivesModule extends BaseModule {
  constructor(context: ContextPlugin) {
    super(context);
  }

  get enabled(): boolean {
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
    const issueEvents = data.events;
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

    this.processEvents("issue", issueEvents, issueTimelineEvents, result);
    this.processReactions(data.self.user.login, issueReactions, result);

    for (const comment of issueComments.filter((comment) => comment.user?.type === "User")) {
      const issueCommentReactions = await octokit.paginate(octokit.rest.reactions.listForIssueComment, {
        owner: owner,
        repo: repo,
        comment_id: comment.id,
        per_page: 100,
      });
      this.processReactions(comment.user?.login, issueCommentReactions, result);
    }

    for (const pull of data.linkedReviews) {
      if (!pull.self) {
        continue;
      }
      const pullTimelineEvents = await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
        owner: pull.self.base.repo.owner.login,
        repo: pull.self.base.repo.name,
        issue_number: pull.self.number,
        per_page: 100,
      });
      const pullEvents = await octokit.paginate(octokit.rest.issues.listEvents, {
        owner: pull.self.base.repo.owner.login,
        repo: pull.self.base.repo.name,
        issue_number: pull.self.number,
        per_page: 100,
      });
      this.processEvents("pull_request", pullEvents, pullTimelineEvents, result);

      if (pull.comments) {
        for (const comment of pull.comments.filter((comment) => comment.user?.type === "User")) {
          const pullCommentReactions = await octokit.paginate(octokit.rest.reactions.listForIssueComment, {
            owner: pull.self.base.repo.owner.login,
            repo: pull.self.base.repo.name,
            comment_id: comment.id,
            per_page: 100,
          });
          this.processReactions(comment.user?.login, pullCommentReactions, result);
        }
      }

      if (pull.reviewComments) {
        for (const reviewComment of pull.reviewComments.filter((comment) => comment.user.type === "User")) {
          this.increaseEventCount(result, reviewComment.user.login, "pull_request.review_comment");
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
    }

    return result;
  }

  processEvents(
    prefix: "pull_request" | "issue",
    events: RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"],
    timelineEvents: RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"],
    result: Result
  ) {
    timelineEvents.forEach((ev) => {
      if ("actor" in ev && ev.actor && ev.actor.type !== "Bot") {
        this.increaseEventCount(result, ev.actor.login, `${prefix}.${ev.event}`);
      }
    });
    events.forEach((ev) => {
      if (
        ev.actor &&
        ev.actor.type !== "Bot" &&
        !timelineEvents
          .filter((e) => "id" in e)
          .map((e) => e.id)
          .includes(ev.id)
      ) {
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
