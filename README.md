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

## Technical Architecture

The Text Conversation Rewards system is a sophisticated GitHub Action that revolutionizes open source collaboration by implementing an AI-powered reward mechanism for quality contributions.

### Core Components

#### Content Evaluation Engine

At the heart of the system is a sophisticated content evaluation module that assigns monetary value to contributor comments in the context of work projects with specifications. Here's how it works:

1. The system processes both issue comments and pull request review comments through different evaluation pipelines, with comprehensive preprocessing that:

   - Removes user commands (starting with /) and bot responses
   - Filters out quoted text (starting with >)
   - Removes HTML comments and footnotes
   - For assigned users, considers comment timestamps to exclude those posted during assignment periods
   - Processes linked pull request comments through GraphQL API
   - Handles minimized/hidden comments
   - Credits only unique links to prevent duplicates

2. For issue comments, it generates a context-aware prompt that includes:

   - The original issue description and specification
   - All comments in the conversation for context
   - The specific comments being evaluated

3. The evaluation process handles GitHub-flavored markdown intelligently:

   - It distinguishes between quoted text (starting with '>') and original content
   - Only evaluates the commenter's original contributions
   - Considers the relationship between comments and their context

4. The language model assigns relevance scores from 0 to 1:
   ```typescript
   interface Relevances {
     [commentId: string]: number; // 0 = irrelevant, 1 = highly relevant
   }
   ```

#### Review Incentivization System

The review incentivization module implements a sophisticated algorithm for rewarding code reviews:

```typescript
interface ReviewScore {
  reviewId: number;
  effect: {
    addition: number;
    deletion: number;
  };
  reward: number;
  priority: number;
}
```

The system calculates rewards based on:

1. The scope of code reviewed (additions + deletions)
2. Issue priority labels
3. The conclusiveness of the review (APPROVED or CHANGES_REQUESTED states receive additional credit)
4. File-specific exclusions through pattern matching

#### Permit Generation and Reward Distribution

The permit generation module handles the secure distribution of rewards:

1. Security Checks:

   - Validates that the issue is collaborative
   - Verifies private key permissions against organization and repository IDs
   - Implements a multi-format encryption system for private keys

2. Fee Processing:

   - Automatically calculates and deducts platform fees
   - Supports token-specific fee exemptions through whitelist
   - Creates treasury allocations for fee distribution

3. Reward Distribution:
   - Generates ERC20 token permits for each contributor
   - Stores permit data securely in a Supabase database
   - Creates claimable reward URLs in the format: `https://pay.ubq.fi?claim=[encoded_permit]`

### Technical Implementation Details

#### Token Management

The system uses decimal.js for precise token calculations:

```typescript
const feeRateDecimal = new Decimal(100).minus(env.PERMIT_FEE_RATE).div(100);
const totalAfterFee = new Decimal(rewardResult.total).mul(feeRateDecimal).toNumber();
```

#### Smart Token Handling

For large conversations, the system implements intelligent token management:

```typescript
// Dynamically handles token limits and chunking for large conversations
_calculateMaxTokens(prompt: string, totalTokenLimit: number = 16384) {
  // Token limit is configurable and adjusts based on model and rate limits
  const inputTokens = this.tokenizer.encode(prompt).length;
  const limit = Math.min(this._configuration?.tokenCountLimit, this._rateLimit);
  return Math.min(inputTokens, limit);
}

// Splits large conversations into manageable chunks
async _splitPromptForEvaluation(specification: string, comments: Comment[]) {
  let chunks = 2;
  while (this._exceedsTokenLimit(comments, chunks)) {
    chunks++;
  }
  return this._processChunks(specification, comments, chunks);
}
```

#### Database Integration

The system maintains a comprehensive record of all permits and rewards:

```typescript
interface PermitRecord {
  amount: string;
  nonce: string;
  deadline: string;
  signature: string;
  beneficiary_id: number;
  location_id: number;
}
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
      llm:
        model: "gpt-4" # Model identifier
        endpoint: "https://api.openrouter.ai/api/v1" # Configurable LLM endpoint
        tokenCountLimit: 124000 # Adjustable token limit
        maxRetries: 3 # Number of retries for rate limits/errors
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
    reviewIncentivizer:
      baseRate: 100
      conclusiveReviewCredit: 25
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
