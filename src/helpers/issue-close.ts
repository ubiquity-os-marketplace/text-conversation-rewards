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

    const closeEvents = timeline
      .filter((event) => event.event === "closed")
      .sort((a, b) => {
        if (!("created_at" in b) || !("created_at" in a)) return 0;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    if (closeEvents.length === 0) {
      return false;
    }

    const latestCloseEvent = closeEvents[0];

    if ("actor" in latestCloseEvent && latestCloseEvent.actor?.type !== "Bot") {
      return false;
    }

    const allComments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    const sortedComments = allComments.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (!("created_at" in latestCloseEvent)) return false;

    const closeTime = new Date(latestCloseEvent.created_at);
    const commandComments = sortedComments.filter((comment) => {
      if (!comment.body) return false;
      const commentTime = new Date(comment.created_at);
      return commentTime < closeTime && comment.body.trim().startsWith("/finish");
    });

    return commandComments.length > 0;
  } catch (e) {
    logger.warn("Failed to check if the issue was closed by a command", { e });
    return false;
  }
}
