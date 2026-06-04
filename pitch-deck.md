---
marp: true
theme: pitch-theme
paginate: true
size: 16:9
title: UbiquityOS Accolades Pitch Deck
description: Plaintext pitch deck source for UbiquityOS Accolades.
---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

<!-- _class: title -->

<div class="hero-title">
  <h1>UbiquityOS<br /><span>Accolades</span></h1>
  <p>Reward the work behind the code.</p>
</div>

<div class="title-mark">
  <img src="assets/pitch/ubiquity-logo-cyan.svg" alt="" />
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Invisible Work

<img class="slide-art art-bg" src="assets/pitch/slide-02-problem.png" alt="" />

- Commits miss the work that moves teams
- Specs, reviews, and coordination drive delivery
- GitHub and Slack hold the evidence, then bury it

<div class="callout"><p>Contribution accounting. Not developer surveillance.</p></div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Why Now

<img class="slide-art art-bg left-fade" src="assets/pitch/slide-03-why-now.png" alt="" />

- AI is raising code volume
- Review and coordination decide what ships
- Enterprises need evidence for rewardable work

<p class="micro">Sources: GitHub Octoverse 2025; Stack Overflow Developer Survey 2025; DORA 2024 and Google Cloud DORA 2025.</p>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Solution

<img class="slide-art art-bg" src="assets/pitch/slide-04-solution.png" alt="" />

<div class="split">

<div>

Engineering artifacts become explainable XP.

- GitHub work events
- Configurable scoring
- Source-linked XP
- Reward records
- Slack-ready expansion

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

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Product Proof

<img class="slide-art art-bg" src="assets/pitch/slide-04-solution.png" alt="" />

<div class="proof-transform">
  <div class="proof-card">
    <div class="eyebrow">Raw evidence</div>
    <p>Issue spec, review thread, merged PR, and simplification diff.</p>
  </div>
  <div class="proof-card">
    <div class="eyebrow">Scoring modules</div>
    <p>Relevance, priority, authorship, readability, and source links.</p>
  </div>
  <div class="proof-card proof-result">
    <div class="eyebrow">Ledger output</div>
    <div class="metric">42.3 XP</div>
    <p>12 source links, 4 reward reasons, export-ready audit trail.</p>
  </div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

<img class="slide-art art-bg art-high" src="assets/pitch/slide-05-promise.png" alt="" />

<div class="center-left">

<div style="margin-bottom: 192px;">
  <p class="quote">One useful unit of work in, one point out.</p>
  <p style="margin-top: 24px; color: var(--muted);">Every point has a person, artifact, reason, and source link.</p>
</div>

</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# How It Works

<img class="slide-art art-bg" src="assets/pitch/slide-06-how-it-works.png" alt="" />

<div class="split">

<div>

- GitHub event enters the kernel
- Plugin collects work evidence
- Modules assign explainable XP
- Ledger stores rewards and audit trail

</div>

<div class="diagram">
  <div class="node">GitHub event</div>
  <div class="node">UbiquityOS kernel</div>
  <div class="node">Accolades plugin</div>
  <div class="node">Evidence scoring</div>
  <div class="node">XP or reward ledger</div>
</div>

</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Live Capabilities

<img class="slide-art art-bg" src="assets/pitch/slide-07-capabilities.png" alt="" />

<div class="capability-grid">
  <div><strong>Specs</strong><span>Requirements and acceptance criteria.</span></div>
  <div><strong>Comments</strong><span>Decision context tied to work.</span></div>
  <div><strong>PR reviews</strong><span>Review value, not review volume.</span></div>
  <div><strong>Merged work</strong><span>Linked implementation evidence.</span></div>
  <div><strong>Simplification</strong><span>Reward deleted complexity.</span></div>
  <div><strong>Payouts</strong><span>XP and rewards in one ledger.</span></div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Plugin Pipeline

<img class="slide-art art-bg" src="assets/pitch/slide-08-architecture.png" alt="" />

<div class="pipeline-flow">
  <div><span>01</span><strong>Collect</strong><p>GitHub events and linked artifacts.</p></div>
  <div><span>02</span><strong>Clean</strong><p>Remove noise and normalize context.</p></div>
  <div><span>03</span><strong>Score</strong><p>Apply relevance, priority, and policy.</p></div>
  <div><span>04</span><strong>Reward</strong><p>Assign explainable XP or payout value.</p></div>
  <div><span>05</span><strong>Audit</strong><p>Post source-linked results.</p></div>
</div>

<div class="callout"><p>Every module produces evidence that can be reviewed later.</p></div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Scoring Philosophy

<img class="slide-art art-bg" src="assets/pitch/slide-09-philosophy.png" alt="" />

- Evidence over activity
- Configurable org policy
- No message-volume rewards
- Source-linked results

<div class="card-row philosophy-tiles">
  <div class="panel"><div class="metric">Evidence</div><div class="metric-label">Every score links back to source work.</div></div>
  <div class="panel"><div class="metric">Policy</div><div class="metric-label">Each org controls how work is weighted.</div></div>
  <div class="panel"><div class="metric">Ledger</div><div class="metric-label">XP and payouts become auditable records.</div></div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Slack Expansion

<img class="slide-art art-bg" src="assets/pitch/slide-10-slack.png" alt="" />

<div class="blur-panel">
Slack counts only when tied to work.

- Linked issue or PR thread
- Decision summary
- Unblocker
- Incident coordination
- Product context

<div class="callout"><p>No points for raw message count.</p></div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Enterprise Dashboard

<img class="slide-art art-bg" src="assets/pitch/slide-11-dashboard.png" alt="" />

<div class="dashboard-frame">
  <div class="dashboard-hero">
    <div class="metric">Contribution Evidence</div>
    <p>One record for contributor, artifact, reason, and source.</p>
  </div>
  <div class="dashboard-modules">
    <div><strong>Contributor rollup</strong><span>Who helped and where.</span></div>
    <div><strong>Scoring reasons</strong><span>Why each artifact counted.</span></div>
    <div><strong>Manager packet</strong><span>Review-ready team evidence.</span></div>
    <div><strong>Audit export</strong><span>Source links for every result.</span></div>
  </div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Competitive Advantage

<img class="slide-art art-bg" src="assets/pitch/slide-12-advantage.png" alt="" />

<div class="contrast-grid">
  <div>
    <div class="eyebrow">Activity dashboards</div>
    <p>Show what happened after the work is already done.</p>
    <span>Volume metrics</span>
    <span>Reports without incentives</span>
    <span>Weak source attribution</span>
  </div>
  <div class="advantage-side">
    <div class="eyebrow">UbiquityOS</div>
    <p>Turns contribution evidence into explainable incentives.</p>
    <span>Artifact-level attribution</span>
    <span>XP and payouts</span>
    <span>GitHub-native audit trail</span>
  </div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Ideal Customers

<img class="slide-art art-bg" src="assets/pitch/slide-13-customers.png" alt="" />

<div class="customer-grid">
  <div><strong>GitHub-first enterprises</strong><span>Need source-linked contribution records.</span></div>
  <div><strong>Open-source programs</strong><span>Need fair reward allocation at scale.</span></div>
  <div><strong>Contractor-heavy teams</strong><span>Need evidence before payout decisions.</span></div>
  <div><strong>Developer experience</strong><span>Need incentives that improve review quality.</span></div>
  <div><strong>Engineering operations</strong><span>Need searchable work evidence.</span></div>
  <div><strong>AI-forward teams</strong><span>Need to reward judgment around generated code.</span></div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Business Model

<img class="slide-art art-bg" src="assets/pitch/slide-14-business-model.png" alt="" />

<div class="pricing-grid">
  <div class="tier">
    <div class="eyebrow">Team</div>
    <div class="tier-name">GitHub XP ledger</div>
    <p>For teams that need transparent contribution accounting.</p>
  </div>
  <div class="tier featured">
    <div class="eyebrow">Business</div>
    <div class="tier-name">Reports and Slack</div>
    <p>Contributor seats, AI evaluation usage, and manager packets.</p>
  </div>
  <div class="tier">
    <div class="eyebrow">Enterprise</div>
    <div class="tier-name">Audit controls</div>
    <p>SSO, RBAC, export workflows, annual contracts, payout fees.</p>
  </div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

# Roadmap

<img class="slide-art art-bg" src="assets/pitch/slide-15-roadmap.png" alt="" />

<div class="roadmap">
  <div>
    <span>Now</span>
    <strong>GitHub ledger</strong>
    <p>Ingestion, contribution scoring, XP, and rewards.</p>
  </div>
  <div>
    <span>Next</span>
    <strong>Operating layer</strong>
    <p>Dashboard, Slack association, searchable ledger.</p>
  </div>
  <div>
    <span>Later</span>
    <strong>Enterprise controls</strong>
    <p>Jira, Linear, manager packets, custom scoring, governance reports.</p>
  </div>
</div>

---

<img class="deck-bg" src="assets/pitch/ubiquity-bg.png" alt="" />
<div class="deck-footer">© 2026 Ubiquity Research Ltd - _______</div>

<img class="slide-art art-bg left-fade" src="assets/pitch/slide-16-positioning.png" alt="" />

<div class="center-left">

<div>
  <p class="quote">The contribution ledger for software teams.</p>
  <p style="margin-top: 24px; color: var(--muted);">Pilot path: connect GitHub, score one repo, export a manager packet.</p>
  <div class="cta-strip">
    <span>Connect</span>
    <span>Score</span>
    <span>Export</span>
  </div>
</div>

</div>
