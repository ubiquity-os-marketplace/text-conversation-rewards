# UbiquityOS Accolades Whitepaper

## Purpose

This document gives a compact but complete context package for another LLM or collaborator working on UbiquityOS Accolades: the product concept, current implementation, positioning, architecture, customer value, and likely next steps.

UbiquityOS Accolades is the current working name for a productized plugin and dashboard concept built on the UbiquityOS plugin architecture. The product turns engineering work artifacts into explainable contribution credit. It starts with GitHub activity and expands toward Slack-linked collaboration evidence, dashboards, and enterprise reporting.

The short pitch:

> UbiquityOS Accolades rewards the work behind the code by turning GitHub and Slack evidence into source-linked contribution credit.

## Company and Platform Context

UbiquityOS is a modular automation platform for GitHub-native workflows. The kernel acts primarily as an event relay: it receives GitHub webhook events, validates and routes them, and invokes plugins. The plugins are independent services that implement domain-specific behavior.

In go-to-market language, each plugin can be positioned as its own product. Accolades is the productization of the contribution and conversation rewards plugin. It is intended to help organizations understand, attribute, and reward the engineering work that does not show up cleanly in commit counts.

The core idea is simple:

> One useful unit of work in, one point out.

Every point should have:

- A contributor
- A work artifact
- A reason
- A source link
- A scoring policy
- A reviewable audit trail

## Product Name

Working name: **UbiquityOS Accolades**

Why this name works:

- It is warmer and less generic than “Contribution Rewards.”
- It avoids sounding like employee surveillance or raw performance scoring.
- It implies recognition, but the product backs recognition with evidence.
- It can cover specs, comments, reviews, merged code, simplification, Slack decisions, and future work sources.

Naming caveat: `Accolades` is a product direction, not a trademark-cleared final name.

## Problem

Modern software delivery depends on more than code commits. Valuable work includes:

- Writing issue specifications
- Clarifying requirements
- Reviewing pull requests
- Requesting changes
- Approving safe changes
- Explaining tradeoffs
- Unblocking teammates
- Deleting unnecessary complexity
- Coordinating incidents or releases
- Summarizing decisions in Slack

Most systems either ignore this work or reduce it to shallow activity metrics. Commit counts, message counts, or PR counts are not good proxies for contribution quality. They are easy to game and can incentivize noise.

Enterprise teams need contribution records that are:

- Source-linked
- Explainable
- Configurable
- Auditable
- Fair across roles
- Useful for managers without becoming surveillance

## Product Thesis

Accolades should not be positioned as an activity dashboard. It should be positioned as a contribution ledger.

Activity dashboards answer:

> What happened?

Accolades answers:

> What useful work happened, who contributed it, why did it count, and where is the source evidence?

The product’s defensible claim is not that it measures all work perfectly. The claim is that it creates structured, inspectable contribution evidence from systems where the work already happens.

## Current Implementation

The current repo is `@ubiquity-os/text-conversation-rewards`. It is a UbiquityOS plugin that evaluates GitHub issue comments, pull request review comments, review activity, and related artifacts to calculate contribution rewards.

The plugin is implemented as a GitHub Actions-compatible UbiquityOS plugin using `@ubiquity-os/plugin-sdk`. The entrypoint creates a Supabase client, builds adapters, and calls the main `run` function.

Current implementation characteristics:

- GitHub-native event handling through UbiquityOS plugin context
- Supabase-backed persistence for permit and reward data
- AI-based content relevance evaluation
- Formatting and content scoring
- Pull request review reward logic
- Reward calculation by role and artifact type
- Permit generation for ERC20 claimable rewards
- Configurable scoring policy
- Optional fee deduction and treasury routing
- Debuggable reward output posted back into GitHub when configured

## What the System Scores Today

The current plugin has strong support for GitHub-based contribution evidence.

Supported or represented contribution categories include:

- Issue specifications
- Issue comments
- Pull request specifications
- Pull request author work
- Pull request assignee work
- Pull request collaborator input
- Pull request contributor input
- Pull request reviews
- Approved reviews
- Changes-requested reviews
- Linked artifact comments
- Markdown-rich contributions
- Source links
- Simplification work, conceptually represented in the pitch deck

The system is designed around scoring work artifacts, not raw activity volume.

## Content Evaluation Engine

The content evaluation engine assigns relevance to comments in the context of a work item.

The system preprocesses GitHub comments before scoring. It filters or normalizes content such as:

- Bot responses
- User commands beginning with `/`
- Quoted text beginning with `>`
- HTML comments
- Footnotes
- Minimized or hidden comments
- Duplicate links
- Comments posted during assignment periods, depending on policy

The evaluation prompt includes:

- The original issue or pull request specification
- The broader conversation context
- The specific comments being evaluated

The model assigns relevance scores between `0` and `1`.

Example shape:

```ts
interface Relevances {
  [commentId: string]: number;
}
```

Interpretation:

- `0`: irrelevant or non-contributory
- `1`: highly relevant to the work outcome
- Values between `0` and `1`: partial contribution value

This relevance score is combined with formatting, role, and policy-based multipliers.

## Formatting and Artifact Scoring

The plugin rewards structured, useful communication differently from plain word volume. It can score Markdown/HTML-derived elements such as:

- Paragraphs
- Lists
- Headings
- Links
- Images
- Code blocks
- Tables
- Emphasis
- Strong text

The plugin supports a configurable `wordValue`, `wordCountExponent`, and element scores. This lets organizations tune how much they value specifications, issue comments, review feedback, links, structured reasoning, and other artifact types.

The reward formula can be summarized as:

```text
artifact reward = formatting score + word value adjusted by relevance and role multipliers
```

The larger product framing should avoid presenting this as “pay per word.” The intended message is:

> Useful structured contribution evidence earns credit when it is relevant to the work.

## Pull Request Review Incentives

The review incentivization system rewards review effort based on meaningful review context. It considers:

- Additions reviewed
- Deletions reviewed
- Issue priority labels
- Review state
- Whether the review was conclusive
- File-specific exclusions

Conclusive reviews such as `APPROVED` or `CHANGES_REQUESTED` can receive additional credit because they directly move work toward merge or correction.

Example shape:

```ts
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

The product message:

> Accolades rewards review value, not review volume.

## Rewards and Permits

The current implementation can generate claimable ERC20 token permits for contributors.

Reward distribution includes:

- Contributor reward calculation
- Optional platform fee calculation
- Optional treasury allocation
- ERC20 permit generation
- Secure storage of permit records in Supabase
- Claim URLs in the form `https://pay.ubq.fi?claim=[encoded_permit]`

The system supports encrypted private key configuration tied to GitHub organization or repository identifiers. This constrains where a reward private key can be used.

This matters for enterprise positioning because the system is not only a dashboard. It can connect contribution accounting to actual incentive distribution.

## Data Model Concept

The output model should be understood as a contribution ledger. A typical contributor record includes:

- GitHub username
- GitHub user ID
- Work artifacts
- Artifact URLs
- Artifact types
- Relevance scores
- Formatting scores
- Role multipliers
- Total reward or XP
- Task reward
- Fee rate
- Payout mode
- Permit URL, when applicable
- Evaluation comment HTML

Example simplified shape:

```json
{
  "userName": {
    "comments": [
      {
        "content": "comment content",
        "url": "https://github.com/org/repo/issues/1#issuecomment-123",
        "type": 18,
        "score": {
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
    "payoutMode": "permit",
    "userId": 123
  }
}
```

## Current Configuration Surface

The plugin is configurable through YAML. Important configuration areas include:

- Data collection retries and delay
- Reward token and EVM network
- Encrypted reward private key
- Close task reward
- Special users such as Copilot
- Required price labels
- Reward limits
- Collaborator-only payment invocation
- External content evaluation retries
- LLM token count limits and retries
- Role-based relevance multipliers
- Original author weight
- User extraction behavior
- Data purge behavior
- Review incentivizer base rate
- Formatting evaluator rules
- GitHub comment posting behavior

The key GTM implication:

> Accolades is policy-driven. Each organization can tune how work should be credited.

## Slack Expansion Concept

Slack support is a planned expansion, not the main current implementation.

The product should not score Slack message volume. Slack should count only when messages are tied to work evidence.

Good Slack scoring candidates:

- A Slack message linked to a GitHub issue or PR
- A decision summary
- An unblocker that changes work direction
- Incident coordination linked to a ticket
- Product context linked to implementation
- Release coordination linked to a work artifact

Bad Slack scoring candidates:

- Raw message count
- Emoji reactions by themselves
- Social chatter
- Status updates with no artifact link
- Repeated messages or noise

Slack positioning:

> Slack counts when it explains, unblocks, or records a decision tied to work.

## Enterprise Dashboard Concept

The desired dashboard should help enterprise teams inspect work contribution across people, teams, repositories, and time.

Important dashboard capabilities:

- Contributor rollups
- Artifact-level source links
- Scoring reasons
- XP or reward totals
- Role-based contribution breakdown
- GitHub activity evidence
- Future Slack-associated evidence
- Manager review packets
- Exportable audit reports
- Team-level trend views
- Configurable scoring policies

The dashboard should avoid leaderboard-first positioning. Leaderboards can create bad incentives. The stronger enterprise use case is reviewable contribution evidence.

Recommended dashboard framing:

> A manager packet for engineering contribution evidence.

## Ideal Customers

Best-fit customer segments:

- GitHub-first enterprises
- Open-source program offices
- Contractor-heavy engineering teams
- Developer relations and ecosystem teams
- Engineering operations teams
- AI-forward software teams
- Organizations that already use issue- or PR-based work tracking
- Teams distributing bounties, grants, or token incentives

The strongest wedge is likely teams that already need to justify or allocate rewards based on GitHub work.

## Buyer and User Personas

Likely buyers:

- VP Engineering
- Head of Developer Experience
- Engineering Operations lead
- Open Source Program Office lead
- CTO at engineering-heavy companies
- Ecosystem grants manager

Likely daily users:

- Engineering managers
- Maintainers
- Program managers
- Developer relations managers
- Contributors checking their own contribution record

Likely technical implementers:

- Platform engineering
- DevOps
- GitHub organization admins
- Internal tools teams

## Core Positioning

Primary positioning statement:

> UbiquityOS Accolades is the contribution ledger for software teams. It turns GitHub and Slack work evidence into explainable XP, rewards, and audit-ready manager reports.

Shorter version:

> Reward the work behind the code.

Functional version:

> Accolades captures GitHub activity, scores useful contribution evidence, and produces source-linked credit for each contributor.

Enterprise version:

> Accolades gives engineering leaders an auditable record of who contributed, what counted, why it counted, and where the evidence lives.

Open-source ecosystem version:

> Accolades helps maintainers distribute rewards fairly by converting contribution evidence into source-linked payouts.

## Key Differentiation

Accolades is different from activity dashboards because it is incentive-aware and evidence-backed.

Compared with normal engineering analytics:

- It does not just show commits or PR counts.
- It scores comments, specifications, and reviews.
- It connects work evidence to XP or reward output.
- It includes source links and explanations.
- It can generate claimable payouts.

Compared with recognition tools:

- It is not based on manual praise alone.
- It uses work artifacts from GitHub.
- It can enforce configurable scoring policy.
- It creates an audit trail.

Compared with payroll or performance tools:

- It does not try to be a full employee evaluation system.
- It focuses on contribution evidence.
- It should be used to inform review and reward workflows, not replace human judgment.

## Important Product Boundaries

The product should avoid these claims:

- “Measures developer productivity perfectly”
- “Automatically evaluates employee performance”
- “Scores all communication”
- “Pays people for messages”
- “Replaces managers”
- “Fully understands engineering quality”

Safer claims:

- “Creates source-linked contribution evidence”
- “Turns work artifacts into explainable credit”
- “Helps teams reward useful work beyond commits”
- “Makes reward decisions auditable”
- “Supports configurable contribution policy”

## Business Model

Possible business model paths:

1. Team tier

   - GitHub XP ledger
   - Basic contribution scoring
   - Source-linked reward summaries

2. Business tier

   - Dashboard
   - Contributor reports
   - Slack association
   - Manager packets
   - AI usage-based limits

3. Enterprise tier

   - SSO
   - RBAC
   - Custom scoring policies
   - Audit exports
   - Governance reports
   - Support and onboarding
   - Annual contracts

4. Payout infrastructure fees

   - Fee on generated rewards or permits
   - Treasury fee routing
   - Token-specific fee exemptions

## Roadmap

Current or near-current:

- GitHub event ingestion
- GitHub comment evaluation
- Pull request review incentives
- Configurable scoring
- XP or token reward calculations
- ERC20 permit generation
- GitHub comment output

Near-term productization:

- Enterprise dashboard
- Contributor rollups
- Manager packets
- Better visual explanations
- Scoring reason exports
- Repo/team filters
- Slack artifact association

Later expansion:

- Jira integration
- Linear integration
- Incident tools
- Calendar or meeting summary association
- Custom scoring governance
- Organization-level benchmarking
- Policy simulation before applying reward changes

## Messaging Pillars

1. Evidence over activity

   Useful work should be linked to artifacts, not inferred from shallow volume metrics.

2. Credit beyond commits

   Specs, reviews, comments, simplification, and coordination all move software forward.

3. Explainable XP

   Every point should have a source, person, reason, and policy.

4. Configurable policy

   Each organization decides how work is weighted.

5. Audit-ready rewards

   Rewards should be reviewable before they become payouts.

## Pitch Deck Narrative

The current deck narrative follows this sequence:

1. Title: UbiquityOS Accolades
2. Invisible Work: commits miss specs, reviews, and coordination
3. Why Now: AI increases code volume, so review and coordination matter more
4. Solution: engineering artifacts become explainable XP
5. Product Proof: raw evidence becomes scored ledger output
6. Promise: one useful unit of work in, one point out
7. How It Works: GitHub event, kernel, plugin, scoring, ledger
8. Live Capabilities: specs, comments, PR reviews, merged work, simplification, payouts
9. Plugin Pipeline: collect, clean, score, reward, audit
10. Scoring Philosophy: evidence, policy, ledger
11. Slack Expansion: only work-linked Slack should count
12. Enterprise Dashboard: contributor evidence and manager reports
13. Competitive Advantage: incentives and attribution, not activity reports
14. Ideal Customers: GitHub-first enterprises, OSS programs, contractor-heavy teams
15. Business Model: team, business, enterprise
16. Roadmap: GitHub ledger, operating layer, enterprise controls
17. Closing: contribution ledger for software teams

## Suggested LLM Prompt for Future Work

Use this when handing the context to another LLM:

```text
You are helping refine product strategy, positioning, and collateral for UbiquityOS Accolades.

Accolades is a UbiquityOS plugin product that turns GitHub work artifacts, and later Slack-linked decisions, into source-linked contribution credit. It should be positioned as a contribution ledger, not an activity dashboard or surveillance tool. The system already evaluates GitHub issue comments, PR reviews, specifications, roles, relevance, formatting, and reward policy. It can generate XP/reward totals and ERC20 permit payouts. The product goal is an enterprise dashboard and manager packet that shows who contributed, what counted, why it counted, and where the source evidence lives.

Avoid generic productivity claims. Emphasize evidence, attribution, configurable policy, reviewability, and fair recognition of work beyond commits.

Help produce concise, enterprise-safe product messaging and collateral.
```

## Open Questions

- Is `Accolades` the final product name or a working name?
- Should the first enterprise product sell XP only, payouts only, or both?
- Should Slack be marketed now as roadmap or included in the main pitch?
- What is the primary buyer: VP Engineering, OSPO lead, or engineering operations?
- Should “XP” remain in enterprise messaging, or should it become “contribution credit”?
- How much should the product expose model scoring internals to managers?
- What governance controls are required before enterprise pilots?
- What is the minimum dashboard needed for a credible pilot?

## Recommended Near-Term Product Focus

The clearest pilot path:

1. Connect one GitHub repository.
2. Score closed issues and merged pull requests.
3. Produce contributor-level XP with source links.
4. Export a manager packet.
5. Review policy with the customer.
6. Add Slack association only after GitHub evidence is trusted.

Recommended pilot promise:

> In one repo, Accolades will show which non-commit contributions moved work forward, why they counted, and where the evidence is.

## One-Sentence Summary

UbiquityOS Accolades is an evidence-backed contribution ledger that helps software teams recognize and reward the useful work behind the code.
