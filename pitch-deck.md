---
marp: true
theme: default
paginate: true
size: 16:9
title: UbiquityOS Contribution Rewards Pitch Deck
description: Plaintext pitch deck source for UbiquityOS Contribution Rewards.
---

<style>
:root {
  --bg: #03080e;
  --cyan: #24cbe5;
  --cyan-deep: #0d7f8a;
  --white: #f4f8fb;
  --muted: #b7c0c8;
  --dim: #7d8992;
  --panel: rgba(4, 16, 24, 0.72);
  --line: rgba(36, 203, 229, 0.22);
}

div {
  backdrop-filter: blur(2px)
}

section {
  position: relative;
  overflow: hidden;
  padding: 54px 68px 66px 70px;
  background-color: var(--bg);
  background-image:
    linear-gradient(90deg, rgba(3, 8, 14, 0.08), rgba(3, 8, 14, 0.64)),
    url("assets/pitch/ubiquity-bg.png");
  background-size: cover;
  background-position: center;
  color: var(--white);
  font-family: "Proxima Nova", Arial, Helvetica, sans-serif;
  letter-spacing: -0.01em;
}

section::before {
  content: "© 2026 Ubiquity Research Ltd - INTERNAL DRAFT";
  position: absolute;
  left: 44px;
  bottom: 31px;
  color: rgba(244, 248, 251, 0.68);
  font-size: 11px;
  letter-spacing: 0.34em;
  z-index: 3;
}

section::after {
  color: rgba(244, 248, 251, 0.58);
  font-size: 11px;
  right: 36px;
  bottom: 29px;
  z-index: 3;
}

section > :not(.slide-art) {
  position: relative;
  z-index: 2;
}

.slide-art {
  position: absolute;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.art-bg {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.25;
  /* filter: saturate(0.9) contrast(1.02); */
  /* transform: scale(1.035); */
}

.title .art-bg {
  opacity: 0.33;
}

h1, h2, h3, p, ul, ol {
  margin: 0;
}

h1 {
  color: var(--cyan);
  font-size: 34px;
  line-height: 1.08;
  font-weight: 400;
  margin-bottom: 38px;
}

h2 {
  color: var(--white);
  font-size: 31px;
  line-height: 1.16;
  font-weight: 400;
  margin-bottom: 22px;
}

h3 {
  color: var(--white);
  font-size: 21px;
  line-height: 1.18;
  font-weight: 700;
  margin-bottom: 10px;
}

p, li {
  color: var(--white);
  font-size: 22px;
  line-height: 1.32;
  font-weight: 400;
}

p + p {
  margin-top: 18px;
}

strong {
  font-weight: 700;
  color: var(--white);
}

em {
  color: var(--cyan);
  font-style: normal;
}

ul {
  list-style: none;
  padding: 0;
  margin-top: 2px;
}

li {
  position: relative;
  margin: 6px 0 0 28px;
}

li::before {
  content: "-";
  position: absolute;
  left: -28px;
  color: var(--white);
}

a {
  color: var(--cyan);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.small, .small li, .small p {
  font-size: 17px;
  line-height: 1.28;
  color: var(--muted);
}

.micro {
  font-size: 12px;
  color: var(--dim);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.title {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 0 90px;
}

.title h1 {
  color: var(--white);
  font-size: 65px;
  font-weight: 400;
  letter-spacing: -0.045em;
  margin: 0;
}

.title h1::before {
  content: "⬡";
  display: inline-grid;
  place-items: center;
  width: 86px;
  height: 86px;
  margin-right: 18px;
  border: 1px solid rgba(244, 248, 251, 0.32);
  border-radius: 50%;
  color: var(--white);
  font-size: 46px;
  vertical-align: middle;
  box-shadow: 0 0 34px rgba(36, 203, 229, 0.16);
}

.title p {
  margin-top: 30px;
  font-size: 21px;
  color: var(--white);
  letter-spacing: 0;
}

.center {
  display: grid;
  place-items: center;
  text-align: center;
  padding-left: 150px;
  padding-right: 150px;
}

.center h1 {
  color: var(--cyan);
  margin-bottom: 0;
}

.center h2 {
  margin-top: 18px;
  font-size: 36px;
}

.split {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 50px;
  align-items: start;
}

.split h1 {
  grid-column: 1 / -1;
  margin-bottom: 2px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 68px;
  align-items: start;
}

.panel {
  background: linear-gradient(180deg, rgba(3, 14, 22, 0.84), rgba(1, 9, 15, 0.62));
  border: 1px solid rgba(36, 203, 229, 0.14);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.24);
  padding: 22px 24px;
}

.card-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 26px;
}

.metric {
  color: var(--white);
  font-size: 34px;
  font-weight: 700;
  line-height: 1.04;
  margin-bottom: 6px;
}

.metric-label {
  color: var(--muted);
  font-size: 15px;
  line-height: 1.22;
}

.callout {
  margin-top: 24px;
  padding: 16px 20px;
  border-left: 2px solid var(--cyan);
  color: var(--white);
  background: rgba(36, 203, 229, 0.055);
}

.callout p {
  font-size: 20px;
}

.diagram {
  display: grid;
  gap: 12px;
  margin-top: 4px;
}

.node {
  position: relative;
  padding: 14px 18px;
  background: rgba(5, 17, 25, 0.78);
  border: 1px solid var(--line);
  color: var(--white);
  font-size: 18px;
}

.node::after {
  content: "";
  position: absolute;
  left: 28px;
  bottom: -13px;
  width: 1px;
  height: 12px;
  background: rgba(36, 203, 229, 0.42);
}

.node:last-child::after {
  display: none;
}

.mock {
  margin-top: 4px;
  background: rgba(1, 8, 13, 0.78);
  border: 1px solid rgba(36, 203, 229, 0.16);
  box-shadow: 0 18px 58px rgba(0, 0, 0, 0.34);
  padding: 18px;
}

.mock-title {
  color: var(--cyan);
  font-size: 15px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 14px;
}

.table {
  display: grid;
  grid-template-columns: 1.1fr 0.75fr 0.75fr 0.75fr;
  gap: 1px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 13px;
}

.cell {
  padding: 9px 10px;
  background: rgba(4, 15, 23, 0.94);
  color: var(--muted);
}

.cell.head {
  color: var(--white);
  background: rgba(36, 203, 229, 0.12);
}

.tag {
  display: inline-block;
  margin: 0 8px 10px 0;
  color: var(--cyan);
  border-bottom: 1px solid rgba(36, 203, 229, 0.55);
  font-size: 18px;
}

.quote {
  max-width: 840px;
  color: var(--white);
  font-size: 37px;
  line-height: 1.18;
}

.deck-note {
  position: absolute;
  right: 70px;
  bottom: 64px;
  color: rgba(244, 248, 251, 0.34);
  font-size: 13px;
  letter-spacing: 0.08em;
}
</style>

<!-- _class: title -->

<img class="slide-art art-bg" src="assets/pitch/slide-01-title.png" alt="" />

# UbiquityOS

Empowering software teams with explainable contribution rewards

---

# Problem

<img class="slide-art art-bg" src="assets/pitch/slide-02-problem.png" alt="" />

- Engineering work is no longer captured by commits alone
- Specifications, reviews, clarifications, and coordination drive delivery
- Slack and GitHub hold critical context, but it disappears into timelines
- Managers still rely on memory, anecdotes, and incomplete dashboards

<div class="callout"><p>Enterprises need contribution accounting, not developer surveillance.</p></div>

---

# Why Now

<img class="slide-art art-bg" src="assets/pitch/slide-03-why-now.png" alt="" />

- AI increases code volume, but code volume is not engineering value
- Distributed teams create more async work across more tools
- Review quality and coordination now determine whether AI output is usable
- Finance and operations need defensible payout records for contributors and contractors

---

# Solution

<img class="slide-art art-bg" src="assets/pitch/slide-04-solution.png" alt="" />

<div class="split">

<div>

UbiquityOS turns engineering artifacts into an auditable XP ledger.

- Capture work from GitHub events
- Score useful contribution with configurable policy
- Attach every point to source evidence
- Persist XP or generate claimable rewards
- Expand into Slack, Jira, Linear, and other work surfaces

</div>

<div class="mock">
  <div class="mock-title">Contribution Output</div>
  <div class="table">
    <div class="cell head">Work</div><div class="cell head">Count</div><div class="cell head">Score</div><div class="cell head">Reward</div>
    <div class="cell">Specification</div><div class="cell">1</div><div class="cell">1.00</div><div class="cell">12.4</div>
    <div class="cell">Issue comment</div><div class="cell">8</div><div class="cell">0.83</div><div class="cell">18.8</div>
    <div class="cell">Code review</div><div class="cell">3</div><div class="cell">priority 2</div><div class="cell">24.0</div>
    <div class="cell">Simplification</div><div class="cell">4 files</div><div class="cell">net -210</div><div class="cell">2.1</div>
  </div>
</div>

</div>

---

# Product Promise

<img class="slide-art art-bg" src="assets/pitch/slide-05-promise.png" alt="" />

<div class="center">

<div>
  <p class="quote">One useful unit of work in, one point out.</p>
  <p style="margin-top: 24px; color: var(--muted);">Every point should explain who contributed, what was recognized, where the evidence lives, and why the work counted.</p>
</div>

</div>

---

# How It Works

<img class="slide-art art-bg" src="assets/pitch/slide-06-how-it-works.png" alt="" />

<div class="split">

<div>

- UbiquityOS kernel relays GitHub events
- Contribution Rewards plugin collects issue, PR, review, and comment evidence
- Modules evaluate formatting, relevance, priority, authorship, review impact, and simplification
- Results are posted back to GitHub and stored as XP or payment records

</div>

<div class="diagram">
  <div class="node">GitHub event</div>
  <div class="node">UbiquityOS kernel</div>
  <div class="node">Contribution Rewards plugin</div>
  <div class="node">Evidence scoring</div>
  <div class="node">XP or reward ledger</div>
</div>

</div>

---

# What Works Today

<img class="slide-art art-bg" src="assets/pitch/slide-07-capabilities.png" alt="" />

- Issue specifications and issue comments
- Pull request review comments
- Linked merged pull requests
- Code review impact incentives
- Code simplification incentives
- Priority and task reward labels
- Assignment-aware filtering to reduce gaming
- XP mode, ERC20 permits, and direct transfer mode

---

# Current Architecture

<img class="slide-art art-bg" src="assets/pitch/slide-08-architecture.png" alt="" />

<div class="two-col small">

<div>

- `UserExtractorModule` identifies contributors
- `DataPurgeModule` removes commands, hidden comments, quotes, and gaming-prone content
- `ExternalContentProcessor` summarizes linked text and images
- `FormattingEvaluatorModule` scores structure, words, and readability

</div>

<div>

- `ContentEvaluatorModule` scores relevance with an LLM
- `ReviewIncentivizerModule` rewards useful code review
- `SimplificationIncentivizerModule` rewards net code reduction
- `PaymentModule` records XP or generates payouts
- `GithubCommentModule` posts the audit trail

</div>

</div>

---

# Scoring Philosophy

<img class="slide-art art-bg" src="assets/pitch/slide-09-philosophy.png" alt="" />

- Score evidence, not raw activity
- Count contribution type, role, relevance, priority, and authorship
- Avoid rewarding message volume
- Cap or weight rewards by task policy
- Keep every result linked to the original artifact

<div class="card-row">
  <div class="panel"><div class="metric">Evidence</div><div class="metric-label">Every score links back to source work.</div></div>
  <div class="panel"><div class="metric">Policy</div><div class="metric-label">Each org controls how work is weighted.</div></div>
  <div class="panel"><div class="metric">Ledger</div><div class="metric-label">XP and payouts become auditable records.</div></div>
</div>

---

# Slack Expansion

<img class="slide-art art-bg" src="assets/pitch/slide-10-slack.png" alt="" />

Slack should count only when it is tied to work.

- Thread linked to a GitHub issue or PR
- Decision summary
- Unblocker that resolves a task
- Incident coordination
- Customer or product context that changes implementation

<div class="callout"><p>No points for raw message count.</p></div>

---

# Enterprise Dashboard

<img class="slide-art art-bg" src="assets/pitch/slide-11-dashboard.png" alt="" />

A system of record for engineering contribution evidence.

<div class="two-col">

<div>

- Individual contribution ledger
- Team contribution distribution
- Review load and review value
- XP by work type
- Pending and claimed rewards

</div>

<div>

- Evidence drilldown to GitHub and Slack
- Manager-ready review packets
- Exportable audit reports
- Custom scoring policy
- Organization-level rollups

</div>

</div>

---

# Competitive Advantage

<img class="slide-art art-bg" src="assets/pitch/slide-12-advantage.png" alt="" />

Most engineering intelligence tools sell dashboards.

UbiquityOS sells an incentive ledger.

- Artifact-level attribution, not just aggregate trends
- Explainable XP, not opaque productivity scoring
- Rewards and payouts, not just reporting
- Plugin architecture, not a closed workflow
- GitHub-native audit trail, not a detached analytics layer

---

# Ideal Customers

<img class="slide-art art-bg" src="assets/pitch/slide-13-customers.png" alt="" />

- GitHub-first engineering organizations
- Open-source programs
- Teams with contractors or external contributors
- Developer experience teams
- Engineering operations teams
- AI-forward teams that need better review visibility
- Distributed teams where async contribution matters

---

# Business Model

<img class="slide-art art-bg" src="assets/pitch/slide-14-business-model.png" alt="" />

<div class="two-col">

<div>

## Packaging

- Team: GitHub contribution ledger and XP dashboard
- Business: GitHub plus Slack, reports, and manager packets
- Enterprise: SSO, RBAC, audit exports, private deployment, retention controls, and custom scoring policy

</div>

<div>

## Pricing

- Per active contributor per month
- Platform fee plus usage-based AI evaluation
- Optional payout or permit fee
- Enterprise annual contracts

</div>

</div>

---

# Roadmap

<img class="slide-art art-bg" src="assets/pitch/slide-15-roadmap.png" alt="" />

<div class="two-col small">

<div>

## Now

- GitHub event ingestion
- Contribution scoring
- XP and reward generation
- GitHub-native audit comments

## Next

- Enterprise dashboard
- Organization-level rollups
- Slack thread association
- Contribution ledger search and exports

</div>

<div>

## Later

- Jira and Linear association
- Manager review packets
- Custom enterprise scoring policies
- Benchmarking and governance reports

</div>

</div>

---

# Positioning

<img class="slide-art art-bg" src="assets/pitch/slide-16-positioning.png" alt="" />

<div class="center">

<div>
  <p class="quote">The contribution ledger for software teams.</p>
  <p style="margin-top: 24px; color: var(--muted);">UbiquityOS turns GitHub and collaboration activity into explainable XP, so enterprises can reward the work that actually moves software forward.</p>
</div>

</div>
