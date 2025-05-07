import { ContextPlugin } from "../types/plugin-input";

export async function manuallyCloseIssue(context: ContextPlugin<"issue_comment.created">) {
  const { payload, octokit, logger } = context;

  logger.debug(`Trying to manually close ${payload.issue.html_url}`);
  try {
    await octokit.rest.issues.update({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      state: "closed",
    });
  } catch (e) {
    logger.warn("Failed to close the issue.", { e });
  }
}

/*
 * Checks if the reason of the issue-closed event was instigated by a `/finish` command
 */
export async function checkIfClosedByCommand(context: ContextPlugin<"issues.closed">) {
  const { payload, octokit, logger } = context;
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueNumber = payload.issue.number;

  try {
    const timeline = await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    const lastReopenedEvent = timeline
      .filter((event) => event.event === "reopened" && "created_at" in event)
      .sort((a, b) => {
        if (!("created_at" in a) || !("created_at" in b)) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];

    const lastClosedEvent = timeline
      .filter((event) => event.event === "closed" && "created_at" in event)
      .sort((a, b) => {
        if (!("created_at" in a) || !("created_at" in b)) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];

    if (!lastClosedEvent) {
      return false;
    }

    if ("actor" in lastClosedEvent && lastClosedEvent.actor?.type !== "Bot") {
      return false;
    }

    const allComments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    if (!("created_at" in lastReopenedEvent) || !("created_at" in lastClosedEvent)) {
      return false;
    }

    const lastReopenedTime = lastReopenedEvent ? new Date(lastReopenedEvent.created_at) : null;
    const closeTime = new Date(lastClosedEvent.created_at);

    const commandComments = allComments.filter((comment) => {
      if (!comment.body) return false;
      const commentTime = new Date(comment.created_at);
      const isAfterLastReopened = lastReopenedTime ? commentTime > lastReopenedTime : true;
      const isBeforeClose = commentTime < closeTime;
      return isAfterLastReopened && isBeforeClose && comment.body.trim().startsWith("/finish");
    });

    return commandComments.length > 0;
  } catch (e) {
    logger.warn("Failed to check if the issue was closed by a command", { e });
    return false;
  }
}
