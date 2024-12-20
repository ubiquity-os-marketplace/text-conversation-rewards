# `@ubiquity-os/text-conversation-rewards`

## How to Get Started

1. **Install dependencies**: Make sure you have [Bun](https://bun.sh/) installed, then run:

   ```sh
   bun install
   ```

2. **Build the UI for production**:

   ```sh
   cd src/web && bun run ui:build
   ```

3. **Copy and paste the `.env.example` and populate the environment variables**

4. **Start the server**:

   ```sh
   bun run server
   ```

## Data structure

```json
{
  "userName": {
    "comments": [
      {
        "content": "comment content",
        "url": "https://url-to-item",
        "type": 18,
        "score": {
          "formatting": {
            "content": {
              "p": {
                "count": 16,
                "score": 1
              }
            },
            "wordValue": 0.1,
            "multiplier": 1
          },
          "reward": 0.8,
          "relevance": 0.5
        }
      }
    ],
    "total": 40.5,
    "task": {
      "reward": 37.5,
      "multiplier": 1
    },
    "feeRate": 0.1,
    "permitUrl": "https://example.com/permit",
    "userId": 123,
    "evaluationCommentHtml": "<p>Evaluation comment</p>"
  }
}
```

Reward formula:

```math
\sum_{i=0}^{n} \left( \sum_{j=0}^{n} \left(\text{wordCount}^{exponent} \times \text{wordValue} \times \text{relevance}\right) + \left(\text{score} \times \text{elementCount}\right) \right) \times multiplier + \text{task.reward} = \text{total}
```

## Plugin configuration

Here is a possible valid configuration to enable this plugin. See [these files](./src/configuration/) for more details.

```yaml
plugin: ubiquity-os/conversation-rewards
with:
  evmNetworkId: 100
  evmPrivateEncrypted: "encrypted-key"
  erc20RewardToken: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"
  dataCollection:
    maxAttempts: 10
    delayMs: 10000
  incentives:
    requirePriceLabel: true
    limitRewards: true
    collaboratorOnlyPaymentInvocation: true
    contentEvaluator:
      openAi:
        model: "gpt-4o"
        endpoint: "https://api.openai.com/v1"
      multipliers:
        - role: [ISSUE_SPECIFICATION]
          relevance: 1
        - role: [PULL_AUTHOR]
          relevance: 1
        - role: [PULL_ASSIGNEE]
          relevance: 1
        - role: [PULL_COLLABORATOR]
          relevance: 1
        - role: [PULL_CONTRIBUTOR]
          relevance: 1
    userExtractor:
      redeemTask: true
    dataPurge:
      skipCommentsWhileAssigned: all
    formattingEvaluator:
      wordCountExponent: 0.85
      multipliers:
        - role: ["ISSUE_SPECIFICATION"]
          multiplier: 1
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.1
        - role: ["ISSUE_AUTHOR"]
          multiplier: 1
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.2
        - role: ["ISSUE_ASSIGNEE"]
          multiplier: 0
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0
        - role: ["ISSUE_COLLABORATOR"]
          multiplier: 1
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.1
        - role: ["ISSUE_CONTRIBUTOR"]
          multiplier: 0.25
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.1
        - role: ["PULL_SPECIFICATION"]
          multiplier: 0
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0
        - role: ["PULL_AUTHOR"]
          multiplier: 2
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.2
        - role: ["PULL_ASSIGNEE"]
          multiplier: 1
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.1
        - role: ["PULL_COLLABORATOR"]
          multiplier: 1
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.1
        - role: ["PULL_CONTRIBUTOR"]
          multiplier: 0.25
          rewards:
            html:
              br: { score: 0, countWords: true }
              code: { score: 5, countWords: false }
              p: { score: 0, countWords: true }
              em: { score: 0, countWords: true }
              img: { score: 5, countWords: true }
              strong: { score: 0, countWords: false }
              blockquote: { score: 0, countWords: false }
              h1: { score: 1, countWords: true }
              h2: { score: 1, countWords: true }
              h3: { score: 1, countWords: true }
              h4: { score: 1, countWords: true }
              h5: { score: 1, countWords: true }
              h6: { score: 1, countWords: true }
              a: { score: 5, countWords: true }
              li: { score: 0.5, countWords: true }
              ul: { score: 1, countWords: true }
              td: { score: 0, countWords: true }
              hr: { score: 0, countWords: true }
              pre: { score: 0, countWords: false }
              ol: { score: 1, countWords: true }
            wordValue: 0.1
      permitGeneration: {}
      githubComment:
        post: true
        debug: false
```

## How to encrypt the `evmPrivateEncrypted` parameter

Partner private key (`evmPrivateEncrypted` config param in `conversation-rewards` plugin) supports 2 formats:

1. `PRIVATE_KEY:GITHUB_OWNER_ID`
2. `PRIVATE_KEY:GITHUB_OWNER_ID:GITHUB_REPOSITORY_ID`

Here `GITHUB_OWNER_ID` can be:

1. GitHub organization id (if ubiquity-os is used within an organization)
2. GitHub user id (if ubiquity-os is simply installed in a user's repository)

Format `PRIVATE_KEY:GITHUB_OWNER_ID` restricts in which particular organization (or user related repositories)
this private key can be used. It can be set either in the organization wide config either in the repository wide one.

Format `PRIVATE_KEY:GITHUB_OWNER_ID:GITHUB_REPOSITORY_ID` restricts organization (or user related repositories) and a particular repository where private key is allowed to be used.

How to encrypt for you local organization for testing purposes:

1. Get your organization (or user) id

```
curl -H "Accept: application/json" -H "Authorization: token GITHUB_PAT_TOKEN" https://api.github.com/orgs/ubiquity
```

2. Open https://keygen.ubq.fi/
3. Click "Generate" to create a new `x25519_PRIVATE_KEY` (which will be used in the `conversation-rewards` plugin to decrypt encrypted wallet private key)
4. Input a string in the format `PRIVATE_KEY:GITHUB_OWNER_ID` in the `PLAIN_TEXT` UI text input where:

- `PRIVATE_KEY`: your ethereum wallet private key without the `0x` prefix
- `GITHUB_OWNER_ID`: your github organization id or user id (which you got from step 1)

5. Click "Encrypt" to get an encrypted value in the `CIPHER_TEXT` field
6. Set the encrypted text (from step 5) in the `evmPrivateEncrypted` config parameter
7. Set `X25519_PRIVATE_KEY` environment variable in github secrets of your forked instance of the `conversation-rewards` plugin
