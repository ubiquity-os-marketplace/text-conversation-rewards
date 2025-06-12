/* eslint-disable @typescript-eslint/naming-convention */
import { useState, InputEvent } from "hono/jsx";
import { render } from "hono/jsx/dom";

function Form() {
  const [response, setResponse] = useState<null | string>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: InputEvent) {
    event.preventDefault();
    setIsLoading(true);
    const owner = event.target?.owner.value;
    const repo = event.target?.repo.value;
    const issueId = event.target?.issue_id.value;
    const useOpenAi = event.target?.openai.checked;
    const useCache = event.target?.cache.checked;
    const payload = {
      owner,
      repo,
      issueId,
      useOpenAi,
      useCache,
    };
    try {
      const result = await fetch("http://localhost:4000", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await result.json();
      const response = data.output
        .flatMap((item) => Object.values(item).map((user) => user.evaluationCommentHtml))
        .join("\n");
      setResponse(response);
    } catch (error) {
      console.error("Error:", error);
      setResponse("Failed to run the plugin, check the console for more details.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div class="container" style={{ marginBottom: "16px" }}>
      <div class="pico">
        <nav>
          <ul />
          <ul>
            <li>
              <strong>@ubiquity-os/text-conversation-rewards</strong>
            </li>
          </ul>
          <ul />
        </nav>
        <form onSubmit={handleSubmit}>
          <fieldset role="group">
            <input name="owner" autoComplete="on" type="text" placeholder="Owner" required />
            <input name="repo" autoComplete="on" type="text" placeholder="Repo" />
            <input name="issue_id" autoComplete="on" type="number" placeholder="Issue ID" />
            <button type="submit" aria-busy={isLoading ? "true" : undefined}>
              Generate
            </button>
          </fieldset>
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
        </form>
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
if (root) {
  render(<App />, root);
}
