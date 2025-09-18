import Decimal from "decimal.js";
import { parseDurationLabel, parsePriorityLabel } from "../helpers/github";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "./plugin-input";
import { LINKED_ISSUES, PullRequestClosingIssue } from "./requests";
import { Result } from "./results";

export interface Module {
  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result>;
  get enabled(): boolean;
}

export abstract class BaseModule implements Module {
  protected context: ContextPlugin;

  constructor(context: ContextPlugin) {
    this.context = context;
  }

  abstract get enabled(): boolean;

  abstract transform(data: Readonly<IssueActivity>, result: Result): Promise<Result>;

  protected isPullRequest(): boolean {
    return (
      "pull_request" in this.context.payload ||
      ("issue" in this.context.payload && !!this.context.payload.issue.pull_request)
    );
  }

  protected async computePriority(data: Readonly<IssueActivity>): Promise<number> {
    try {
      if (!this.isPullRequest()) {
        return parsePriorityLabel(data?.self?.labels);
      }

      const pullNumber = data.self?.number;
      const owner = this.context.payload.repository.owner.login;
      const repo = this.context.payload.repository.name;
      if (!pullNumber) {
        return parsePriorityLabel(data?.self?.labels);
      }

      const linked = await this.context.octokit.graphql.paginate<PullRequestClosingIssue>(LINKED_ISSUES, {
        owner,
        repo,
        pull_number: pullNumber,
      });

      const edges = linked.repository.pullRequest.closingIssuesReferences.edges ?? [];

      let weightedSum = new Decimal(0);
      let weightTotal = new Decimal(0);
      for (const edge of edges) {
        const labels = edge.node.labels?.nodes;
        const priority = parsePriorityLabel(labels);
        const durationHours = parseDurationLabel(labels); // hours
        if (durationHours && durationHours > 0) {
          const duration = new Decimal(durationHours);
          weightedSum = weightedSum.add(new Decimal(priority).mul(duration));
          weightTotal = weightTotal.add(duration);
        }
      }

      if (weightTotal.gt(0)) {
        return weightedSum.div(weightTotal).toDecimalPlaces(2).toNumber();
      }
      return parsePriorityLabel(data?.self?.labels);
    } catch (e) {
      this.context.logger.warn("Failed to compute the averaged priority, using a fallback.", { e });
      return parsePriorityLabel(data?.self?.labels);
    }
  }
}
