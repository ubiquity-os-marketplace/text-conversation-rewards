type PluginInstance = {
  fetch: (request: Request) => Response | Promise<Response>;
  use: (...args: unknown[]) => void;
  get: (...args: unknown[]) => void;
  post: (...args: unknown[]) => void;
};

type LlmMessage = {
  message?: {
    content?: string | null;
  };
};

function createMockPlugin(): PluginInstance {
  return {
    fetch() {
      return new Response("Not Implemented", { status: 501 });
    },
    use() {
      return;
    },
    get() {
      return;
    },
    post() {
      return;
    },
  };
}

export function createActionsPlugin(): PluginInstance {
  return createMockPlugin();
}

export function createPlugin(): PluginInstance {
  return createMockPlugin();
}

export async function callLlm(): Promise<{ choices: LlmMessage[] }> {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ relevances: [] }),
        },
      },
    ],
  };
}
