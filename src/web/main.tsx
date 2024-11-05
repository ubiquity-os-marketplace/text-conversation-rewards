import { useState, Event } from "hono/jsx";
import { render } from "hono/jsx/dom";

function Form() {
  const [url, setUrl] = useState("");
  const [response, setResponse] = useState(null);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
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
              permitGeneration: {},
              githubComment: {
                post: false,
                debug: true,
              },
            },
          },
          authToken: "{{GITHUB_TOKEN}}",
          eventPayload: {
            issue: {
              state_reason: "completed",
              url: "https://api.github.com/repos/{{OWNER_REPO}}/issues/1",
              repository_url: "https://api.github.com/repos/{{OWNER_REPO}}",
              labels_url: "https://api.github.com/repos/{{OWNER_REPO}}/issues/1/labels{/name}",
              comments_url: "https://api.github.com/repos/{{OWNER_REPO}}/issues/1/comments",
              events_url: "https://api.github.com/repos/{{OWNER_REPO}}/issues/1/events",
              html_url: "https://github.com/{{OWNER_REPO}}/issues/1",
              id: 1,
              node_id: "MDU6SXNzdWUx",
              number: 1,
              title: "Found a bug",
              user: {
                login: "meniole",
                id: 1,
                node_id: "MDQ6VXNlcjE=",
                avatar_url: "https://github.com/images/error/meniole_happy.gif",
                gravatar_id: "",
                url: "https://api.github.com/users/meniole",
                html_url: "https://github.com/meniole",
                followers_url: "https://api.github.com/users/meniole/followers",
                following_url: "https://api.github.com/users/meniole/following{/other_user}",
                gists_url: "https://api.github.com/users/meniole/gists{/gist_id}",
                starred_url: "https://api.github.com/users/meniole/starred{/owner}{/repo}",
                subscriptions_url: "https://api.github.com/users/meniole/subscriptions",
                organizations_url: "https://api.github.com/users/meniole/orgs",
                repos_url: "https://api.github.com/users/meniole/repos",
                events_url: "https://api.github.com/users/meniole/events{/privacy}",
                received_events_url: "https://api.github.com/users/meniole/received_events",
                type: "User",
                site_admin: false,
              },
              state: "closed",
              locked: false,
              assignee: {
                login: "meniole",
                id: 1,
                node_id: "MDQ6VXNlcjE=",
                avatar_url: "https://github.com/images/error/meniole_happy.gif",
                gravatar_id: "",
                url: "https://api.github.com/users/meniole",
                html_url: "https://github.com/meniole",
                followers_url: "https://api.github.com/users/meniole/followers",
                following_url: "https://api.github.com/users/meniole/following{/other_user}",
                gists_url: "https://api.github.com/users/meniole/gists{/gist_id}",
                starred_url: "https://api.github.com/users/meniole/starred{/owner}{/repo}",
                subscriptions_url: "https://api.github.com/users/meniole/subscriptions",
                organizations_url: "https://api.github.com/users/meniole/orgs",
                repos_url: "https://api.github.com/users/meniole/repos",
                events_url: "https://api.github.com/users/meniole/events{/privacy}",
                received_events_url: "https://api.github.com/users/meniole/received_events",
                type: "User",
                site_admin: false,
              },
              labels: [
                {
                  id: 208045946,
                  node_id: "MDU6TGFiZWwyMDgwNDU5NDY=",
                  url: "https://api.github.com/repos/{{OWNER_REPO}}/labels/bug",
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
              full_name: "meniole/conversation-rewards",
              owner: {
                login: "meniole",
                id: 159901852,
                node_id: "MDQ6VXNlcjE=",
                avatar_url: "https://github.com/images/error/meniole_happy.gif",
                gravatar_id: "",
                url: "https://api.github.com/users/meniole",
                html_url: "https://github.com/meniole",
                followers_url: "https://api.github.com/users/meniole/followers",
                following_url: "https://api.github.com/users/meniole/following{/other_user}",
                gists_url: "https://api.github.com/users/meniole/gists{/gist_id}",
                starred_url: "https://api.github.com/users/meniole/starred{/owner}{/repo}",
                subscriptions_url: "https://api.github.com/users/meniole/subscriptions",
                organizations_url: "https://api.github.com/users/meniole/orgs",
                repos_url: "https://api.github.com/users/meniole/repos",
                events_url: "https://api.github.com/users/meniole/events{/privacy}",
                received_events_url: "https://api.github.com/users/meniole/received_events",
                type: "User",
                site_admin: false,
              },
              private: false,
              html_url: "https://github.com/meniole/conversation-rewards",
              description: "This your first repo!",
              fork: false,
              url: "https://api.github.com/repos/meniole/conversation-rewards",
              archive_url: "https://api.github.com/repos/meniole/conversation-rewards/{archive_format}{/ref}",
              assignees_url: "https://api.github.com/repos/meniole/conversation-rewards/assignees{/user}",
              blobs_url: "https://api.github.com/repos/meniole/conversation-rewards/git/blobs{/sha}",
              branches_url: "https://api.github.com/repos/meniole/conversation-rewards/branches{/branch}",
              collaborators_url:
                "https://api.github.com/repos/meniole/conversation-rewards/collaborators{/collaborator}",
              comments_url: "https://api.github.com/repos/meniole/conversation-rewards/comments{/number}",
              commits_url: "https://api.github.com/repos/meniole/conversation-rewards/commits{/sha}",
              compare_url: "https://api.github.com/repos/meniole/conversation-rewards/compare/{base}...{head}",
              contents_url: "https://api.github.com/repos/meniole/conversation-rewards/contents/{+path}",
              contributors_url: "https://api.github.com/repos/meniole/conversation-rewards/contributors",
              deployments_url: "https://api.github.com/repos/meniole/conversation-rewards/deployments",
              downloads_url: "https://api.github.com/repos/meniole/conversation-rewards/downloads",
              events_url: "https://api.github.com/repos/meniole/conversation-rewards/events",
              forks_url: "https://api.github.com/repos/meniole/conversation-rewards/forks",
              git_commits_url: "https://api.github.com/repos/meniole/conversation-rewards/git/commits{/sha}",
              git_refs_url: "https://api.github.com/repos/meniole/conversation-rewards/git/refs{/sha}",
              git_tags_url: "https://api.github.com/repos/meniole/conversation-rewards/git/tags{/sha}",
              git_url: "git:github.com/meniole/conversation-rewards.git",
              issue_comment_url: "https://api.github.com/repos/meniole/conversation-rewards/issues/comments{/number}",
              issue_events_url: "https://api.github.com/repos/meniole/conversation-rewards/issues/events{/number}",
              issues_url: "https://api.github.com/repos/meniole/conversation-rewards/issues{/number}",
              keys_url: "https://api.github.com/repos/meniole/conversation-rewards/keys{/key_id}",
              labels_url: "https://api.github.com/repos/meniole/conversation-rewards/labels{/name}",
              languages_url: "https://api.github.com/repos/meniole/conversation-rewards/languages",
              merges_url: "https://api.github.com/repos/meniole/conversation-rewards/merges",
              milestones_url: "https://api.github.com/repos/meniole/conversation-rewards/milestones{/number}",
              notifications_url:
                "https://api.github.com/repos/meniole/conversation-rewards/notifications{?since,all,participating}",
              pulls_url: "https://api.github.com/repos/meniole/conversation-rewards/pulls{/number}",
              releases_url: "https://api.github.com/repos/meniole/conversation-rewards/releases{/id}",
              stargazers_url: "https://api.github.com/repos/meniole/conversation-rewards/stargazers",
              statuses_url: "https://api.github.com/repos/meniole/conversation-rewards/statuses/{sha}",
              subscribers_url: "https://api.github.com/repos/meniole/conversation-rewards/subscribers",
              subscription_url: "https://api.github.com/repos/meniole/conversation-rewards/subscription",
              tags_url: "https://api.github.com/repos/meniole/conversation-rewards/tags",
              teams_url: "https://api.github.com/repos/meniole/conversation-rewards/teams",
              trees_url: "https://api.github.com/repos/meniole/conversation-rewards/git/trees{/sha}",
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
              login: "meniole",
              id: 159901852,
              node_id: "MDQ6VXNlcjE=",
              avatar_url: "https://github.com/images/error/meniole_happy.gif",
              gravatar_id: "",
              url: "https://api.github.com/users/meniole",
              html_url: "https://github.com/meniole",
              followers_url: "https://api.github.com/users/meniole/followers",
              following_url: "https://api.github.com/users/meniole/following{/other_user}",
              gists_url: "https://api.github.com/users/meniole/gists{/gist_id}",
              starred_url: "https://api.github.com/users/meniole/starred{/owner}{/repo}",
              subscriptions_url: "https://api.github.com/users/meniole/subscriptions",
              organizations_url: "https://api.github.com/users/meniole/orgs",
              repos_url: "https://api.github.com/users/meniole/repos",
              events_url: "https://api.github.com/users/meniole/events{/privacy}",
              received_events_url: "https://api.github.com/users/meniole/received_events",
              type: "User",
              site_admin: false,
            },
          },
        }),
      });
      const data = await result.json();
      setResponse(data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="text" value={url} onChange={(e) => setUrl(e.target?.value)} placeholder="Enter URL" />
        <button type="submit">Submit</button>
      </form>
      {response && <div>Response: {JSON.stringify(response)}</div>}
    </div>
  );
}

function App() {
  return <Form />;
}

const root = document.getElementById("root");
render(<App />, root);
