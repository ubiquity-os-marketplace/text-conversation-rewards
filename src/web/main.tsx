import { useState, InputEvent } from "hono/jsx";
import { render } from "hono/jsx/dom";

function Form() {
  const [response, setResponse] = useState<null | string>(null);

  const handleSubmit = async (event: InputEvent) => {
    event.preventDefault();
    const ownerRepo = `${event.target.owner.value}/${event.target.repo.value}`;
    const issueId = event.target.issue_id.value;
    try {
      const result = await fetch("http://localhost:3000", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "development",
          stateId: "1234",
          signature: "",
          eventName: "issues.closed",
          action: "closed",
          env: {
            SUPABASE_URL: "http://localhost:5432",
            SUPABASE__KEY: "1234",
          },
          settings: {
            evmPrivateEncrypted:
              "YfEnpznMNbSPhCQzWy1Uevi4xQC25SqJrHd87CjjS1gsu92QrCReSgvl8Z_pVI1ZM57PNC1mZSgHbNgX9ITmOJc6qaOJ_mRe_sP_8jBcNimusDCQcWEkcPIW7Md-QGDPnwuN8FIavS7I0uiOIRYK6h0NK02-3uzPqhM",
            incentives: {
              userExtractor: {},
              dataPurge: {},
              formattingEvaluator: {},
              contentEvaluator: {},
              permitGeneration: null,
              githubComment: {
                post: false,
                debug: true,
              },
            },
          },
          authToken: import.meta.env.VITE_GITHUB_TOKEN,
          eventPayload: {
            issue: {
              state_reason: "completed",
              url: `https://api.github.com/repos/${ownerRepo}/issues/${issueId}`,
              repository_url: `https://api.github.com/repos/${ownerRepo}`,
              labels_url: `https://api.github.com/repos/${ownerRepo}/issues/${issueId}/labels{/name}`,
              comments_url: `https://api.github.com/repos/${ownerRepo}/issues/${issueId}/comments`,
              events_url: `https://api.github.com/repos/${ownerRepo}/issues/${issueId}/events`,
              html_url: `https://github.com/${ownerRepo}/issues/${issueId}`,
              id: 1,
              node_id: "MDU6SXNzdWUx",
              number: 1,
              title: "Found a bug",
              user: {
                login: "ubiquity-os",
                id: 1,
                node_id: "MDQ6VXNlcjE=",
                avatar_url: "https://github.com/images/error/ubiquity-os_happy.gif",
                gravatar_id: "",
                url: "https://api.github.com/users/ubiquity-os",
                html_url: "https://github.com/ubiquity-os",
                followers_url: "https://api.github.com/users/ubiquity-os/followers",
                following_url: "https://api.github.com/users/ubiquity-os/following{/other_user}",
                gists_url: "https://api.github.com/users/ubiquity-os/gists{/gist_id}",
                starred_url: "https://api.github.com/users/ubiquity-os/starred{/owner}{/repo}",
                subscriptions_url: "https://api.github.com/users/ubiquity-os/subscriptions",
                organizations_url: "https://api.github.com/users/ubiquity-os/orgs",
                repos_url: "https://api.github.com/users/ubiquity-os/repos",
                events_url: "https://api.github.com/users/ubiquity-os/events{/privacy}",
                received_events_url: "https://api.github.com/users/ubiquity-os/received_events",
                type: "User",
                site_admin: false,
              },
              state: "closed",
              locked: false,
              assignee: {
                login: "ubiquity-os",
                id: 1,
                node_id: "MDQ6VXNlcjE=",
                avatar_url: "https://github.com/images/error/ubiquity-os_happy.gif",
                gravatar_id: "",
                url: "https://api.github.com/users/ubiquity-os",
                html_url: "https://github.com/ubiquity-os",
                followers_url: "https://api.github.com/users/ubiquity-os/followers",
                following_url: "https://api.github.com/users/ubiquity-os/following{/other_user}",
                gists_url: "https://api.github.com/users/ubiquity-os/gists{/gist_id}",
                starred_url: "https://api.github.com/users/ubiquity-os/starred{/owner}{/repo}",
                subscriptions_url: "https://api.github.com/users/ubiquity-os/subscriptions",
                organizations_url: "https://api.github.com/users/ubiquity-os/orgs",
                repos_url: "https://api.github.com/users/ubiquity-os/repos",
                events_url: "https://api.github.com/users/ubiquity-os/events{/privacy}",
                received_events_url: "https://api.github.com/users/ubiquity-os/received_events",
                type: "User",
                site_admin: false,
              },
              labels: [
                {
                  id: 208045946,
                  node_id: "MDU6TGFiZWwyMDgwNDU5NDY=",
                  url: `https://api.github.com/repos/${ownerRepo}/labels/bug`,
                  name: "bug",
                  description: "Something isn't working",
                  color: "f29513",
                  default: true,
                },
              ],
              comments: 0,
              created_at: "2011-04-22T13:33:48Z",
              updated_at: "2011-04-22T13:33:48Z",
              closed_at: "2011-04-22T13:33:48Z",
              author_association: "OWNER",
              body: "I'm having a problem with this.",
            },
            repository: {
              id: 1296269,
              node_id: "MDEwOlJlcG9zaXRvcnkxMjk2MjY5",
              name: "conversation-rewards",
              full_name: "ubiquity-os/conversation-rewards",
              owner: {
                login: "ubiquity-os",
                id: 159901852,
                node_id: "MDQ6VXNlcjE=",
                avatar_url: "https://github.com/images/error/ubiquity-os_happy.gif",
                gravatar_id: "",
                url: "https://api.github.com/users/ubiquity-os",
                html_url: "https://github.com/ubiquity-os",
                followers_url: "https://api.github.com/users/ubiquity-os/followers",
                following_url: "https://api.github.com/users/ubiquity-os/following{/other_user}",
                gists_url: "https://api.github.com/users/ubiquity-os/gists{/gist_id}",
                starred_url: "https://api.github.com/users/ubiquity-os/starred{/owner}{/repo}",
                subscriptions_url: "https://api.github.com/users/ubiquity-os/subscriptions",
                organizations_url: "https://api.github.com/users/ubiquity-os/orgs",
                repos_url: "https://api.github.com/users/ubiquity-os/repos",
                events_url: "https://api.github.com/users/ubiquity-os/events{/privacy}",
                received_events_url: "https://api.github.com/users/ubiquity-os/received_events",
                type: "User",
                site_admin: false,
              },
              private: false,
              html_url: "https://github.com/ubiquity-os/conversation-rewards",
              description: "This your first repo!",
              fork: false,
              url: "https://api.github.com/repos/ubiquity-os/conversation-rewards",
              archive_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/{archive_format}{/ref}",
              assignees_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/assignees{/user}",
              blobs_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/git/blobs{/sha}",
              branches_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/branches{/branch}",
              collaborators_url:
                "https://api.github.com/repos/ubiquity-os/conversation-rewards/collaborators{/collaborator}",
              comments_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/comments{/number}",
              commits_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/commits{/sha}",
              compare_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/compare/{base}...{head}",
              contents_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/contents/{+path}",
              contributors_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/contributors",
              deployments_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/deployments",
              downloads_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/downloads",
              events_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/events",
              forks_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/forks",
              git_commits_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/git/commits{/sha}",
              git_refs_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/git/refs{/sha}",
              git_tags_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/git/tags{/sha}",
              git_url: "git:github.com/ubiquity-os/conversation-rewards.git",
              issue_comment_url:
                "https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/comments{/number}",
              issue_events_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/events{/number}",
              issues_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/issues{/number}",
              keys_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/keys{/key_id}",
              labels_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/labels{/name}",
              languages_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/languages",
              merges_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/merges",
              milestones_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/milestones{/number}",
              notifications_url:
                "https://api.github.com/repos/ubiquity-os/conversation-rewards/notifications{?since,all,participating}",
              pulls_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls{/number}",
              releases_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/releases{/id}",
              stargazers_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/stargazers",
              statuses_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/statuses/{sha}",
              subscribers_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/subscribers",
              subscription_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/subscription",
              tags_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/tags",
              teams_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/teams",
              trees_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/git/trees{/sha}",
              homepage: "https://github.com",
              language: null,
              forks_count: 9,
              stargazers_count: 80,
              watchers_count: 80,
              size: 108,
              default_branch: "master",
              open_issues_count: 0,
              is_template: false,
              topics: [],
              has_issues: true,
              has_projects: true,
              has_wiki: true,
              has_pages: false,
              has_downloads: true,
              archived: false,
              disabled: false,
              visibility: "public",
              pushed_at: "2011-01-26T19:06:43Z",
              created_at: "2011-01-26T19:01:12Z",
              updated_at: "2011-01-26T19:14:43Z",
              permissions: {
                admin: false,
                maintain: false,
                push: false,
                triage: false,
                pull: true,
              },
              allow_rebase_merge: true,
              temp_clone_token: "",
              allow_squash_merge: true,
              allow_auto_merge: false,
              delete_branch_on_merge: true,
              allow_merge_commit: true,
              subscribers_count: 42,
              network_count: 0,
            },
            sender: {
              login: "ubiquity-os",
              id: 159901852,
              node_id: "MDQ6VXNlcjE=",
              avatar_url: "https://github.com/images/error/ubiquity-os_happy.gif",
              gravatar_id: "",
              url: "https://api.github.com/users/ubiquity-os",
              html_url: "https://github.com/ubiquity-os",
              followers_url: "https://api.github.com/users/ubiquity-os/followers",
              following_url: "https://api.github.com/users/ubiquity-os/following{/other_user}",
              gists_url: "https://api.github.com/users/ubiquity-os/gists{/gist_id}",
              starred_url: "https://api.github.com/users/ubiquity-os/starred{/owner}{/repo}",
              subscriptions_url: "https://api.github.com/users/ubiquity-os/subscriptions",
              organizations_url: "https://api.github.com/users/ubiquity-os/orgs",
              repos_url: "https://api.github.com/users/ubiquity-os/repos",
              events_url: "https://api.github.com/users/ubiquity-os/events{/privacy}",
              received_events_url: "https://api.github.com/users/ubiquity-os/received_events",
              type: "User",
              site_admin: false,
            },
          },
        }),
      });
      const data = await result.json();
      setResponse(
        Object.values(data.output)
          .map((o) => o.evaluationCommentHtml)
          .join("\n")
      );
    } catch (error) {
      console.error("Error:", error);
      setResponse("Failed to run the plugin, check the console for more details.");
    }
  };

  return (
    <div class="container">
      <div class="pico" style={{ paddingTop: "16px" }}>
        <form onSubmit={handleSubmit}>
          <fieldset role="group">
            <input name="owner" autocomplete="on" type="text" placeholder="Owner" required />
            <input name="repo" autocomplete="on" type="text" placeholder="Repo" required />
            <input name="issue_id" autocomplete="on" type="number" placeholder="Issue ID" required />
            <button type="submit">Generate</button>
          </fieldset>
        </form>
        <fieldset>
          <legend>Options</legend>
          <label>
            <input type="checkbox" name="cache" checked />
            Enable cache
          </label>
          <label>
            <input type="checkbox" name="openai" checked />
            Enable OpenAi
          </label>
        </fieldset>
      </div>
      {response && (
        <article
          style={{ paddingLeft: "16px", paddingRight: "16px", borderRadius: "8px" }}
          class="markdown-body"
          dangerouslySetInnerHTML={{ __html: response }}
        ></article>
      )}
    </div>
  );
}

function App() {
  return <Form />;
}

const root = document.getElementById("root");
render(<App />, root);
