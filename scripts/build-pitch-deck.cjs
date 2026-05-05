const pptxgen = require("pptxgenjs");
const path = require("path");
const { getBuildInfo } = require("./deck-build-info.cjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "UbiquityOS";
pptx.subject = "UbiquityOS Contribution Rewards";
pptx.title = "UbiquityOS Contribution Rewards Pitch Deck";
pptx.company = "UbiquityOS";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Proxima Nova",
  bodyFontFace: "Proxima Nova",
  lang: "en-US",
};
pptx.defineLayout({ name: "CUSTOM_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "CUSTOM_WIDE";
pptx.margin = 0;
pptx.slideWidth = 13.333;
pptx.slideHeight = 7.5;
pptx.layout = "CUSTOM_WIDE";
pptx.masterSlide = {};
pptx._slides = pptx._slides || [];
pptx._layouts = pptx._layouts || [];
pptx._slideLayouts = pptx._slideLayouts || [];
pptx._theme = pptx._theme || {};
pptx._theme.headFontFace = "Proxima Nova";
pptx._theme.bodyFontFace = "Proxima Nova";
pptx._theme.lang = "en-US";
pptx.layout = "CUSTOM_WIDE";

const { root: ROOT, revision: REVISION, stem: EXPORT_STEM } = getBuildInfo();
const bgPath = path.join(ROOT, "assets/pitch/ubiquity-bg.png");
const wordmarkPath = path.join(ROOT, "assets/pitch/ubiquity-dao-wordmark.png");

const W = 13.333;
const H = 7.5;
const C = {
  white: "F4F8FB",
  cyan: "24CBE5",
  muted: "B7C0C8",
  dim: "7D8992",
  darkPanel: "041018",
  panel2: "061722",
  black: "03080E",
  line: "195A66",
};
const FONT = "Proxima Nova";

function addBackground(slide) {
  slide.background = { color: C.black };
  slide.addImage({ path: bgPath, x: 0, y: 0, w: W, h: H });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: W,
    h: H,
    fill: { color: C.black, transparency: 20 },
    line: { transparency: 100 },
  });
}

function addFooter(slide, n) {
  slide.addImage({ path: wordmarkPath, x: 0.43, y: 6.81, w: 1.14, h: 0.172 });
  slide.addText(REVISION, {
    x: 1.72,
    y: 6.81,
    w: 0.54,
    h: 0.14,
    fontFace: FONT,
    fontSize: 5.8,
    color: "A8B1B8",
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });
  if (n) {
    slide.addText(String(n), {
      x: 12.9,
      y: 6.78,
      w: 0.17,
      h: 0.14,
      fontFace: FONT,
      fontSize: 7,
      color: "A8B1B8",
      margin: 0,
      align: "right",
      breakLine: false,
      fit: "shrink",
    });
  }
}

function addTitle(slide, title) {
  slide.addText(title, {
    x: 0.55,
    y: 0.46,
    w: 10.8,
    h: 0.45,
    fontFace: FONT,
    fontSize: 21,
    bold: false,
    color: C.cyan,
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });
}

function addBody(slide, text, x, y, w, h, fontSize = 15, color = C.white, opts = {}) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontFace: FONT,
    fontSize,
    color,
    margin: 0,
    breakLine: false,
    valign: "top",
    fit: "shrink",
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 7,
    breakLine: false,
    ...opts,
  });
}

function addBullets(slide, bullets, x, y, w, h, fontSize = 15, lineGap = 0.28) {
  const text = bullets.map((b) => `-   ${b}`).join("\n");
  addBody(slide, text, x, y, w, h, fontSize, C.white, {
    breakLine: false,
    fit: "shrink",
    paraSpaceAfterPt: Math.round(lineGap * 14),
  });
}

function addSubBullets(slide, title, bullets, x, y, w, h) {
  addBody(slide, title, x, y, w, 0.24, 13.5, C.white, { bold: true });
  addBullets(slide, bullets, x, y + 0.35, w, h - 0.35, 12.6, 0.16);
}

function addCallout(slide, text, x, y, w, h) {
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: C.darkPanel, transparency: 18 },
    line: { color: C.cyan, transparency: 35, width: 1 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.035,
    h,
    fill: { color: C.cyan, transparency: 0 },
    line: { transparency: 100 },
  });
  addBody(slide, text, x + 0.18, y + 0.14, w - 0.34, h - 0.22, 13.8, C.white, { paraSpaceAfterPt: 0 });
}

function addMetricPanel(slide, x, y, w, h, title, sub) {
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: C.darkPanel, transparency: 16 },
    line: { color: C.line, transparency: 30, width: 0.8 },
  });
  addBody(slide, title, x + 0.18, y + 0.18, w - 0.36, 0.38, 19, C.white, { bold: true, paraSpaceAfterPt: 0 });
  addBody(slide, sub, x + 0.18, y + 0.68, w - 0.36, h - 0.82, 10.8, C.muted, { paraSpaceAfterPt: 0 });
}

function addMockTable(slide, x, y, w, h) {
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    fill: { color: "01080D", transparency: 7 },
    line: { color: C.line, transparency: 35, width: 1 },
  });
  addBody(slide, "CONTRIBUTION OUTPUT", x + 0.18, y + 0.14, w - 0.36, 0.2, 9.5, C.cyan, { charSpace: 1.1 });
  const cols = [1.35, 0.65, 0.75, 0.75];
  const startX = x + 0.22;
  const startY = y + 0.58;
  const rowH = 0.34;
  const rows = [
    ["Work", "Count", "Score", "Reward"],
    ["Specification", "1", "1.00", "12.4"],
    ["Issue comment", "8", "0.83", "18.8"],
    ["Code review", "3", "P2", "24.0"],
    ["Simplification", "4 files", "-210", "2.1"],
  ];
  rows.forEach((row, r) => {
    let cx = startX;
    row.forEach((cell, c) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: cx,
        y: startY + r * rowH,
        w: cols[c],
        h: rowH - 0.01,
        fill: { color: r === 0 ? "07303A" : "041018", transparency: r === 0 ? 5 : 1 },
        line: { color: "15333B", transparency: 15, width: 0.5 },
      });
      addBody(slide, cell, cx + 0.07, startY + r * rowH + 0.08, cols[c] - 0.12, 0.12, 7.8, r === 0 ? C.white : C.muted, { paraSpaceAfterPt: 0, bold: r === 0 });
      cx += cols[c];
    });
  });
}

function addDiagram(slide, x, y) {
  const nodes = ["GitHub event", "UbiquityOS kernel", "Contribution Rewards plugin", "Evidence scoring", "XP or reward ledger"];
  nodes.forEach((node, i) => {
    const yy = y + i * 0.68;
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y: yy,
      w: 4.1,
      h: 0.42,
      fill: { color: C.darkPanel, transparency: 10 },
      line: { color: C.line, transparency: 18, width: 0.8 },
    });
    addBody(slide, node, x + 0.18, yy + 0.12, 3.72, 0.12, 11.5, C.white, { paraSpaceAfterPt: 0 });
    if (i < nodes.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: x + 0.26,
        y: yy + 0.43,
        w: 0,
        h: 0.25,
        line: { color: C.cyan, transparency: 54, width: 0.8 },
      });
    }
  });
}

function addSlide(title, bodyFn) {
  const slide = pptx.addSlide();
  addBackground(slide);
  addTitle(slide, title);
  bodyFn(slide);
  addFooter(slide, pptx._slides.length);
  return slide;
}

// 1 Title
{
  const slide = pptx.addSlide();
  addBackground(slide);
  slide.addShape(pptx.ShapeType.ellipse, { x: 2.43, y: 2.27, w: 0.95, h: 0.95, fill: { color: C.black, transparency: 100 }, line: { color: "DDE7EE", transparency: 52, width: 0.8 } });
  addBody(slide, "⬡", 2.61, 2.39, 0.58, 0.48, 33, C.white, { paraSpaceAfterPt: 0, align: "center", fit: "shrink" });
  addBody(slide, "UbiquityOS\nContribution Rewards", 3.48, 2.18, 5.9, 0.96, 28, C.white, { paraSpaceAfterPt: 0, breakLine: true });
  addBody(slide, "Reward the work behind the code.", 2.65, 3.45, 7.7, 0.28, 13.3, C.white, { paraSpaceAfterPt: 0, align: "center" });
  addFooter(slide, null);
}

addSlide("Invisible Work", (slide) => {
  addBullets(slide, [
    "Commits miss the work that moves teams",
    "Specs, reviews, and coordination drive delivery",
    "GitHub and Slack hold the evidence, then bury it",
  ], 0.7, 1.18, 10.7, 2.0, 15.2);
  addCallout(slide, "Contribution accounting. Not developer surveillance.", 0.72, 4.15, 7.55, 0.62);
});

addSlide("Why Now", (slide) => {
  addBullets(slide, [
    "AI is raising code volume",
    "Review and coordination decide what ships",
    "Enterprises need evidence for rewardable work",
  ], 0.7, 1.18, 11.25, 2.75, 14.6, 0.08);
  slide.addShape(pptx.ShapeType.line, {
    x: 0.7,
    y: 5.42,
    w: 4.8,
    h: 0,
    line: { color: "F4F8FB", transparency: 84, width: 0.6 },
  });
  addBody(slide, "Sources: GitHub Octoverse 2025; Stack Overflow Developer Survey 2025; DORA 2024 and Google Cloud DORA 2025.", 0.7, 5.52, 7.65, 0.24, 6.4, "B7C0C8", {
    transparency: 28,
    charSpace: 0.35,
    paraSpaceAfterPt: 0,
  });
});

addSlide("Solution", (slide) => {
  addBody(slide, "Engineering artifacts become explainable XP.", 0.7, 1.15, 5.45, 0.62, 17, C.white, { paraSpaceAfterPt: 0 });
  addBullets(slide, [
    "GitHub work events",
    "Configurable scoring",
    "Source-linked XP",
    "Reward records",
    "Slack-ready expansion",
  ], 0.7, 2.08, 5.6, 2.3, 13.4, 0.16);
  addMockTable(slide, 7.18, 1.1, 4.35, 2.7);
});

addSlide("Product Promise", (slide) => {
  addBody(slide, "One useful unit of work in, one point out.", 2.02, 2.6, 9.3, 0.58, 29.5, C.white, { paraSpaceAfterPt: 0, align: "center" });
  addBody(slide, "Every point has a person, artifact, reason, and source link.", 2.45, 3.45, 8.42, 0.72, 15.8, C.muted, { paraSpaceAfterPt: 0, align: "center" });
});

addSlide("How It Works", (slide) => {
  addBullets(slide, [
    "GitHub event enters the kernel",
    "Plugin collects work evidence",
    "Modules assign explainable XP",
    "Ledger stores rewards and audit trail",
  ], 0.7, 1.18, 6.1, 2.8, 13.2, 0.13);
  addDiagram(slide, 8.2, 1.18);
});

addSlide("Live Capabilities", (slide) => {
  addBullets(slide, [
    "Specs and comments",
    "PR reviews",
    "Linked merged work",
    "Review incentives",
    "Simplification rewards",
    "XP and payouts",
  ], 0.7, 1.18, 9.6, 3.6, 14.2, 0.1);
});

addSlide("Plugin Pipeline", (slide) => {
  addSubBullets(slide, "Collection and cleanup", [
    "Identify contributors",
    "Clean noisy comments",
    "Enrich linked content",
    "Score readability",
  ], 0.7, 1.16, 5.6, 2.7);
  addSubBullets(slide, "Scoring and output", [
    "Score relevance",
    "Reward reviews",
    "Reward simplification",
    "Save XP and payouts",
    "Post audit comments",
  ], 7.15, 1.16, 5.55, 2.9);
});

addSlide("Scoring Philosophy", (slide) => {
  addBullets(slide, [
    "Evidence over activity",
    "Configurable org policy",
    "No message-volume rewards",
    "Source-linked results",
  ], 0.7, 1.16, 10.7, 1.95, 14.4, 0.08);
  addMetricPanel(slide, 0.76, 4.35, 3.65, 1.1, "Evidence", "Every score links back to source work.");
  addMetricPanel(slide, 4.84, 4.35, 3.65, 1.1, "Policy", "Each org controls how work is weighted.");
  addMetricPanel(slide, 8.92, 4.35, 3.65, 1.1, "Ledger", "XP and payouts become auditable records.");
});

addSlide("Slack Expansion", (slide) => {
  addBody(slide, "Slack counts only when tied to work.", 0.7, 1.16, 7.6, 0.36, 16.2, C.white, { paraSpaceAfterPt: 0 });
  addBullets(slide, [
    "Linked issue or PR thread",
    "Decision summary",
    "Unblocker",
    "Incident coordination",
    "Product context",
  ], 0.7, 1.9, 8.25, 2.4, 14.2, 0.12);
  addCallout(slide, "No points for raw message count.", 0.72, 4.78, 4.4, 0.58);
});

addSlide("Enterprise Dashboard", (slide) => {
  addBody(slide, "A system of record for contribution evidence.", 0.7, 1.16, 7.8, 0.36, 16, C.white, { paraSpaceAfterPt: 0 });
  addBullets(slide, [
    "Who contributed?",
    "What work counted?",
    "Why was it scored?",
    "Where is evidence?",
  ], 0.7, 2.0, 5.2, 2.4, 13.6, 0.1);
  addBullets(slide, [
    "Team rollups",
    "Review value",
    "Manager packets",
    "Audit exports",
  ], 7.1, 2.0, 5.3, 2.4, 13.6, 0.1);
});

addSlide("Competitive Advantage", (slide) => {
  addBody(slide, "Dashboards show activity.", 0.7, 1.16, 7.3, 0.35, 16, C.white, { paraSpaceAfterPt: 0 });
  addBody(slide, "UbiquityOS creates incentives.", 0.7, 1.72, 7.3, 0.35, 16, C.white, { bold: true, paraSpaceAfterPt: 0 });
  addBullets(slide, [
    "Artifact-level attribution",
    "Explainable XP",
    "Rewards and payouts, not just reporting",
    "Plugin architecture",
    "GitHub-native audit trail",
  ], 0.7, 2.5, 10.7, 2.4, 14.2, 0.1);
});

addSlide("Ideal Customers", (slide) => {
  addBullets(slide, [
    "GitHub-first enterprises",
    "Open-source programs",
    "Contractor-heavy teams",
    "Developer experience teams",
    "Engineering operations teams",
    "AI-forward teams",
  ], 0.7, 1.18, 9.8, 3.1, 14.4, 0.1);
});

addSlide("Business Model", (slide) => {
  addSubBullets(slide, "Packaging", [
    "Team: GitHub XP ledger",
    "Business: Slack and reports",
    "Enterprise: SSO, RBAC, audit exports",
  ], 0.7, 1.16, 5.7, 2.7);
  addSubBullets(slide, "Pricing", [
    "Active contributor seats",
    "Usage-based AI evaluation",
    "Payout fees",
    "Annual contracts",
  ], 7.1, 1.16, 5.5, 2.4);
});

addSlide("Roadmap", (slide) => {
  addSubBullets(slide, "Now", [
    "GitHub ingestion",
    "Contribution scoring",
    "XP and rewards",
  ], 0.7, 1.16, 3.75, 2.1);
  addSubBullets(slide, "Next", [
    "Enterprise dashboard",
    "Slack association",
    "Searchable ledger",
  ], 4.78, 1.16, 3.75, 2.1);
  addSubBullets(slide, "Later", [
    "Jira and Linear",
    "Manager packets",
    "Custom scoring",
    "Governance reports",
  ], 8.86, 1.16, 3.75, 2.1);
});

addSlide("Positioning", (slide) => {
  addBody(slide, "The contribution ledger for software teams.", 2.05, 2.45, 9.25, 0.58, 28, C.white, { paraSpaceAfterPt: 0, align: "center" });
  addBody(slide, "Explainable XP for the work that moves software forward.", 2.42, 3.3, 8.48, 0.72, 15.2, C.muted, { paraSpaceAfterPt: 0, align: "center" });
});

pptx.writeFile({ fileName: path.join(ROOT, "exports", `${EXPORT_STEM}.pptx`) }).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
