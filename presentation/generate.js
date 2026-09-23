/**
 * Within — final presentation (18 slides).
 * Modern SaaS-documentation visual language: white/light-grey background,
 * bordered white cards, a blue accent, and small outlined Feather icons
 * (pre-rendered to PNG by render_icons.js) — matching the reference deck
 * the client approved, per their explicit direction to prioritize that
 * over the earlier "no icons / match the real app" iteration.
 *
 * Palette:
 *   page bg #F7F8FA   card #FFFFFF   border #E5E7EB
 *   ink-900 #111827   ink-700 #374151   ink-500 #6B7280   ink-400 #9CA3AF
 *   accent (blue) #2563EB   accent-soft #DBEAFE
 *
 * Type scale (nothing explanatory below 15pt):
 *   TITLE 42 / CONCEPT 32 / LABEL 26 / BODY 20 / CODE 17 / SMALL 15 / FOOTER 12
 *
 * Layout: one fixed content grid for every slide — header reserves room for
 * a title up to two lines (so real, unshortened titles never collide with
 * the rule below them), and body content always starts at the same y.
 *
 * Text-height note (measured empirically): lineSpacingMultiple in this
 * renderer adds a large space-before offset rather than just line spacing,
 * so it is not used. Default spacing measures ~1.126 * fontSize/72 in/line.
 */
const pptxgen = require("/Users/syondukea/Software/Projects/Classwork/within/node_modules/pptxgenjs/dist/pptxgen.cjs.js");
const path = require("path");

const ICON_DIR = path.join(__dirname, "assets", "icons");

// ---------------------------------------------------------------- palette --
const C = {
  paper: "F7F8FA", // page background
  white: "FFFFFF", // card background
  ink950: "111827", // primary text
  ink700: "374151", // secondary text
  ink500: "6B7280", // muted text
  ink300: "9CA3AF", // faint text
  ink200: "E5E7EB", // borders
  ink100: "F3F4F6", // subtle fill
  accent: "2563EB", // blue accent
  accentSoft: "DBEAFE", // light blue fill
};

const F = { sans: "Arial", code: "Courier New" };
const FS = { title: 42, concept: 32, label: 26, body: 20, code: 17, small: 15, footer: 12 };
const LH = (pt) => (pt * 1.126) / 72;

const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN = 1.0;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_TOP = 2.15; // fixed for every content slide, regardless of title length
const FOOTER_Y = PAGE_H - 0.45;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Within";
pres.company = "Within";

// ------------------------------------------------------------- utilities --
function bg(slide, color) {
  slide.background = { color };
}

function txt(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fontFace: opts.font ?? F.sans,
    fontSize: opts.size ?? FS.body,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: opts.color ?? C.ink950,
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    margin: 0,
    charSpacing: opts.tracking ?? undefined,
  });
}

// strict horizontal/vertical line — never a diagonal, never eyeballed
function line(slide, x1, y1, x2, y2, opts = {}) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 0.001);
  const h = Math.max(Math.abs(y2 - y1), 0.001);
  const ascending = (x1 < x2 && y1 > y2) || (x1 > x2 && y1 < y2);
  slide.addShape("line", {
    x,
    y,
    w,
    h,
    flipV: ascending,
    line: { color: opts.color ?? C.ink200, width: opts.width ?? 1.25, dashType: opts.dash ?? "solid" },
  });
}

function hrule(slide, x, y, w, opts = {}) {
  line(slide, x, y, x + w, y, { color: opts.color ?? C.ink200, width: opts.width ?? 1 });
}

function rect(slide, x, y, w, h, opts = {}) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    fill: opts.fill ? { color: opts.fill } : { type: "none" },
    line: opts.line ? { color: opts.line, width: opts.lineWidth ?? 1 } : { type: "none" },
  });
}

function tick(slide, x, y, size, opts = {}) {
  rect(slide, x - size / 2, y - size / 2, size, size, { fill: opts.fill ?? C.ink950 });
}

// Pre-rendered Feather icon (see render_icons.js). color: "ink" | "blue" | "white" | "grey"
function icon(slide, name, color, x, y, size) {
  slide.addImage({ path: path.join(ICON_DIR, `${name}-${color}.png`), x, y, w: size, h: size });
}

// A white, bordered card — the deck's recurring container.
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    rectRadius: opts.radius ?? 0.09,
    fill: { color: opts.fill ?? C.white },
    line: { color: opts.line ?? C.ink200, width: opts.lineWidth ?? 1 },
    shadow: opts.shadow
      ? { type: "outer", color: "1F2937", opacity: 0.08, blur: 6, offset: 2, angle: 90 }
      : undefined,
  });
}

// A small icon badge: icon centered in a rounded square, tinted background optional.
function iconBadge(slide, x, y, size, name, opts = {}) {
  const bg = opts.bg ?? C.accentSoft;
  const iconColor = opts.iconColor ?? "blue";
  slide.addShape("roundRect", { x, y, w: size, h: size, rectRadius: size * 0.28, fill: { color: bg }, line: { type: "none" } });
  const pad = size * 0.24;
  icon(slide, name, iconColor, x + pad, y + pad, size - pad * 2);
}

// A small filled circle with a white number — the citation mark.
function citationCircle(slide, x, y, d, number, opts = {}) {
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: opts.fill ?? C.accent }, line: { type: "none" } });
  txt(slide, String(number), { x, y: y - 0.01, w: d, h: d, font: F.sans, bold: true, size: opts.size ?? 11, color: C.white, align: "center", valign: "middle" });
}

// Title reserves fixed room for up to two lines, so the rule below it sits
// in the same place on every slide regardless of how long the real title is.
function header(slide, headline) {
  txt(slide, headline, { x: MARGIN, y: 0.5, w: CONTENT_W, h: 1.3, font: F.sans, bold: true, size: FS.title, color: C.ink950 });
  hrule(slide, MARGIN, 1.95, CONTENT_W, { color: C.ink200, width: 1.25 });
}

function footer(slide, n, total) {
  txt(slide, "WITHIN", { x: MARGIN, y: FOOTER_Y, w: 2, h: 0.26, font: F.sans, size: FS.footer, color: C.ink300, tracking: 1.2 });
  txt(slide, `${String(n).padStart(2, "0")} / ${total}`, { x: PAGE_W - MARGIN - 2, y: FOOTER_Y, w: 2, h: 0.26, font: F.sans, size: FS.footer, color: C.ink300, align: "right" });
}

// LABEL / thin rule / mono field list — the deck's recurring technical module
function specEntry(slide, x, y, w, label, fields) {
  txt(slide, label, { x, y, w, h: 0.42, font: F.sans, bold: true, size: FS.label - 4, color: C.ink950 });
  hrule(slide, x, y + 0.5, w, { color: C.ink200 });
  let fy = y + 0.66;
  (fields ?? []).forEach((f) => {
    txt(slide, f, { x, y: fy, w, h: 0.32, font: F.code, size: FS.code, color: C.ink700 });
    fy += 0.36;
  });
  return fy;
}

// Vertical labeled chain, connected by a tick+line spine that always
// terminates exactly at each node — geometry computed, never eyeballed.
function verticalChain(slide, x, startY, items, gaps, opts = {}) {
  const ys = [];
  let y = startY;
  items.forEach((it) => {
    ys.push(y);
    y += gaps[ys.length - 1] ?? 1.0;
  });
  const tickInset = opts.tickInset ?? 0.22;
  line(slide, x, ys[0] + tickInset, x, ys[ys.length - 1] + tickInset, { color: opts.lineColor ?? C.ink200, width: 1.25 });
  items.forEach((it, i) => {
    tick(slide, x, ys[i] + tickInset, opts.tickSize ?? 0.1, { fill: it.color ?? opts.tickColor ?? C.ink950 });
    txt(slide, it.label, {
      x: x + (opts.labelGap ?? 0.38),
      y: ys[i],
      w: opts.labelW ?? 6,
      h: (it.size ?? FS.label) / 60,
      font: F.sans,
      bold: true,
      size: it.size ?? FS.label,
      color: it.color ?? opts.labelColor ?? C.ink950,
    });
    if (it.sub) {
      txt(slide, it.sub, {
        x: x + (opts.labelGap ?? 0.38),
        y: ys[i] + LH(it.size ?? FS.label) + 0.14,
        w: opts.labelW ?? 6,
        h: 0.3,
        font: F.code,
        size: it.subSize ?? FS.code,
        color: C.ink700,
      });
    }
  });
  return { ys, bottom: ys[ys.length - 1] + tickInset };
}

// A field of small document cards — a few carry a real file/folder/image
// icon (deterministic, seeded), the rest stay plain to keep the field quiet.
function docGrid(slide, opts = {}) {
  const area = opts.area;
  const cols = opts.cols;
  const rows = opts.rows;
  const gap = opts.gap ?? 0.16;
  const cw = (area.w - gap * (cols - 1)) / cols;
  const ch = (area.h - gap * (rows - 1)) / rows;
  const marks = opts.marks ?? [];
  const iconSet = ["file", "filetext", "folder", "image"];
  let seed = opts.seed ?? 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const iconEvery = opts.iconEvery ?? 6;
  let cellIdx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isMark = marks.some((m) => m.r === r && m.c === c);
      const x = area.x + c * (cw + gap),
        y = area.y + r * (ch + gap);
      slide.addShape("roundRect", {
        x,
        y,
        w: cw,
        h: ch,
        rectRadius: 0.05,
        fill: { color: isMark ? opts.markFill ?? C.accent : C.white },
        line: { color: isMark ? opts.markFill ?? C.accent : opts.line ?? C.ink200, width: 1 },
      });
      if (isMark && opts.markIcon) {
        const s = Math.min(cw, ch) * 0.42;
        icon(slide, opts.markIcon, "white", x + (cw - s) / 2, y + (ch - s) / 2, s);
      } else if (!isMark && opts.showIcons !== false && cellIdx % iconEvery === Math.floor(iconEvery / 2)) {
        const s = Math.min(cw, ch) * 0.42;
        icon(slide, iconSet[Math.floor(rnd() * iconSet.length)], "grey", x + (cw - s) / 2, y + (ch - s) / 2, s);
      }
      cellIdx++;
    }
  }
  return { cw, ch };
}

// ================================================================ SLIDE 1 =
function slide01() {
  const s = pres.addSlide();
  bg(s, C.paper);
  docGrid(s, { area: { x: MARGIN, y: 0.8, w: CONTENT_W, h: 3.9 }, cols: 11, rows: 4, gap: 0.2 });

  txt(s, "Your knowledge is already there.", { x: MARGIN, y: 5.15, w: CONTENT_W, h: 0.85, font: F.sans, bold: true, size: FS.title + 4, color: C.ink950 });
  txt(s, "Notes, PDFs, wiki pages, and other documents already contain the information we need.", {
    x: MARGIN,
    y: 6.05,
    w: CONTENT_W,
    h: 0.5,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });
  footer(s, 1, 18);
  s.addNotes("Open. A large, precise field of document fragments — the knowledge already exists. No architecture, no UI yet.");
}

// ================================================================ SLIDE 2 =
function slide02() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "The problem isn’t knowledge. It’s finding it.");

  txt(s, "You may have hundreds of documents and thousands of chunks. A question still needs to find the few pieces that actually matter.", {
    x: MARGIN,
    y: CONTENT_TOP,
    w: CONTENT_W,
    h: 0.65,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  const chainX = MARGIN + 1.0;
  const chain = verticalChain(
    s,
    chainX,
    CONTENT_TOP + 0.95,
    [
      { label: "A QUESTION", size: FS.concept - 4, color: C.ink950 },
      { label: "MANY DOCUMENT CHUNKS", size: FS.concept - 4, color: C.ink950 },
      { label: "RELEVANT EVIDENCE", size: FS.concept - 4, color: C.accent },
    ],
    [1.0, 1.0],
    { tickSize: 0.06 }
  );
  const chainIcons = ["filetext", "database", "search"];
  chainIcons.forEach((name, i) => {
    iconBadge(s, chainX - 0.95, chain.ys[i] - 0.03, 0.5, name, {
      bg: i === 2 ? C.accent : C.accentSoft,
      iconColor: i === 2 ? "white" : "blue",
    });
  });

  txt(s, 'Example: “how do you uniquely identify a row in a table?” — a real project in Within holds 86 chunks from a single document.', {
    x: MARGIN,
    y: 6.35,
    w: CONTENT_W,
    h: 0.45,
    font: F.code,
    size: FS.small,
    color: C.ink500,
  });
  footer(s, 2, 18);
  s.addNotes("Make the problem visually obvious before naming any solution: a question, a pile of candidate chunks, and the small slice that's actually relevant.");
}

// ================================================================ SLIDE 3 =
function slide03() {
  const s = pres.addSlide();
  bg(s, C.paper);

  const nodeSize = 1.6,
    gapW = 1.05;
  const totalW = nodeSize * 3 + gapW * 2;
  const startX = (PAGE_W - totalW) / 2;
  const nodeY = 0.8;
  const nodes = [
    { x: startX, label: "Documents", icon: "filetext", emphasize: false },
    { x: startX + nodeSize + gapW, label: "Within", icon: "database", emphasize: true },
    { x: startX + (nodeSize + gapW) * 2, label: "LLM", icon: "cpu", emphasize: false },
  ];
  nodes.forEach((n) => {
    card(s, n.x, nodeY, nodeSize, nodeSize, {
      fill: n.emphasize ? C.accentSoft : C.white,
      line: n.emphasize ? C.accent : C.ink200,
      lineWidth: n.emphasize ? 1.5 : 1,
      shadow: true,
    });
    const iconSize = 0.62;
    icon(s, n.icon, n.emphasize ? "blue" : "ink", n.x + (nodeSize - iconSize) / 2, nodeY + 0.32, iconSize);
    txt(s, n.label, { x: n.x, y: nodeY + nodeSize - 0.5, w: nodeSize, h: 0.35, font: F.sans, bold: true, size: 16, color: C.ink950, align: "center" });
  });
  [0, 1].forEach((i) => {
    const ax = nodes[i].x + nodeSize;
    txt(s, "→", { x: ax, y: nodeY + nodeSize / 2 - 0.25, w: gapW, h: 0.5, font: F.sans, size: 26, color: C.ink300, align: "center", valign: "middle" });
  });

  const belowY = nodeY + nodeSize;
  txt(s, "DOCUMENTS   →   CHUNKS   →   EMBEDDINGS   →   RETRIEVAL", {
    x: 0,
    y: belowY + 0.3,
    w: PAGE_W,
    h: 0.35,
    font: F.sans,
    size: FS.small,
    color: C.ink500,
    align: "center",
    tracking: 0.8,
  });

  txt(s, "Within.", { x: 0, y: belowY + 0.82, w: PAGE_W, h: 1.1, font: F.sans, bold: true, size: 66, color: C.ink950, align: "center" });
  txt(s, "An AI-native knowledge database.", { x: 0, y: belowY + 1.9, w: PAGE_W, h: 0.4, font: F.sans, size: 20, color: C.ink700, align: "center" });
  txt(s, "It stores documents, breaks them into searchable chunks, retrieves the relevant evidence, and hands that evidence to an LLM.", {
    x: 1.6,
    y: belowY + 2.4,
    w: PAGE_W - 3.2,
    h: 0.5,
    font: F.sans,
    size: FS.small,
    color: C.ink500,
    align: "center",
  });
  footer(s, 3, 18);
  s.addNotes("First product reveal, plus a one-line summary of the whole pipeline so nobody is lost before the deep dive starts.");
}

// ================================================================ SLIDE 4 =
function slide04() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "The LLM is not the database.");

  const spineX = MARGIN + 0.15;
  const chain = verticalChain(
    s,
    spineX,
    CONTENT_TOP,
    [
      { label: "KNOWLEDGE", size: 24, color: C.ink700 },
      { label: "DATABASE", size: 34, color: C.ink950 },
      { label: "RETRIEVAL", size: 30, color: C.ink950 },
      { label: "LLM", size: 26, color: C.ink950 },
      { label: "ANSWER", size: 22, color: C.accent },
    ],
    [0.85, 1.05, 0.95, 0.8]
  );

  const rx = spineX + 4.0;
  const rw = PAGE_W - MARGIN - rx;
  const notes = [
    { i: 1, text: "Stores the actual knowledge." },
    { i: 2, text: "Finds the pieces relevant to the question." },
    { i: 3, text: "Turns those pieces into a useful answer." },
  ];
  notes.forEach((n) => {
    txt(s, n.text, { x: rx, y: chain.ys[n.i] + 0.02, w: rw, h: 0.65, font: F.sans, size: FS.body, color: C.ink700 });
  });

  hrule(s, MARGIN, 6.35, CONTENT_W, { color: C.ink200 });
  txt(s, "The model speaks last.", { x: MARGIN, y: 6.47, w: CONTENT_W, h: 0.48, font: F.sans, bold: true, size: FS.concept, color: C.ink950 });
  footer(s, 4, 18);
  s.addNotes("Two columns: a plain vertical stack (Database and Retrieval sized as the dominant elements) beside the thesis, aligned to the exact computed y of each node.");
}

// ================================================================ SLIDE 5 =
function slide05() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "First: put the knowledge in a database.");

  txt(s, "PostgreSQL is where Within stores the structured representation of the knowledge — every document, and every chunk of every document.", {
    x: MARGIN,
    y: CONTENT_TOP,
    w: CONTENT_W,
    h: 0.65,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  const tables = [
    { name: "projects", fields: ["id", "name", "description"] },
    { name: "documents", fields: ["id", "project_id", "title", "source"] },
    { name: "document_chunks", fields: ["content", "embedding VECTOR(384)", "tsv TSVECTOR"] },
  ];
  const colW = (CONTENT_W - 1.0) / 3;
  const schemaY = CONTENT_TOP + 0.9;
  const colBottoms = tables.map((t, i) => specEntry(s, MARGIN + i * (colW + 0.5), schemaY, colW, t.name, t.fields));
  const schemaBottom = Math.max(...colBottoms);

  hrule(s, MARGIN, schemaBottom + 0.15, CONTENT_W, { color: C.ink200 });
  txt(s, "A long document is split into smaller chunks, so retrieval can return the one relevant passage — not the entire document.", {
    x: MARGIN,
    y: schemaBottom + 0.3,
    w: CONTENT_W,
    h: 0.55,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  const dY = schemaBottom + 1.3;
  txt(s, "DOCUMENT", { x: MARGIN, y: dY, w: 1.8, h: 0.4, font: F.sans, bold: true, size: FS.label - 4, color: C.ink950 });
  const arrowX0 = MARGIN + 1.85,
    arrowX1 = MARGIN + 2.55;
  line(s, arrowX0, dY + 0.22, arrowX1, dY + 0.22, { color: C.ink300, width: 1.25 });
  const chunkX0 = arrowX1 + 0.15;
  const chunkW = 1.75,
    chunkGap = 0.25;
  ["CHUNK 1", "CHUNK 2", "CHUNK 3", "CHUNK 4"].forEach((c, i) => {
    const cx = chunkX0 + i * (chunkW + chunkGap);
    rect(s, cx, dY - 0.06, chunkW, 0.56, { line: C.ink300, lineWidth: 1 });
    txt(s, c, { x: cx, y: dY, w: chunkW, h: 0.42, font: F.code, size: FS.code, color: C.ink700, align: "center", valign: "middle" });
  });
  footer(s, 5, 18);
  s.addNotes("Schema taught plainly, then chunking explained with one concrete example: a document splitting into four chunks.");
}

// ================================================================ SLIDE 6 =
function slide06() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "One chunk. Two ways to search it.");

  txt(s, "chunk 64 — “A relation is commonly represented as a table. A tuple represents a row in a table…”", {
    x: MARGIN,
    y: CONTENT_TOP,
    w: CONTENT_W,
    h: 0.45,
    font: F.code,
    size: FS.code,
    color: C.ink700,
  });
  hrule(s, MARGIN, CONTENT_TOP + 0.6, CONTENT_W, { color: C.ink200 });

  const colW = (CONTENT_W - 0.8) / 2;
  const colY = CONTENT_TOP + 0.85;
  const cols = [
    {
      x: MARGIN,
      title: "FULL-TEXT SEARCH",
      def: "Looks for words and phrases that literally appear in the text.",
      qLabel: "Query:",
      query: '"uniquely identify a row"',
      match: "Shares the words “row” and “table” with the chunk — a direct lexical match.",
      verdict: "Finds it because the words match.",
    },
    {
      x: MARGIN + colW + 0.8,
      title: "SEMANTIC SEARCH",
      def: "Looks for meaning, even when the exact words differ.",
      qLabel: "Query:",
      query: '"how do you uniquely identify a row?"',
      match: "Different phrasing, same underlying idea as “a tuple represents a row.”",
      verdict: "Finds it because the meaning is related.",
    },
  ];
  cols.forEach((c) => {
    txt(s, c.title, { x: c.x, y: colY, w: colW, h: 0.4, font: F.sans, bold: true, size: FS.label - 4, color: C.ink950 });
    txt(s, c.def, { x: c.x, y: colY + 0.45, w: colW, h: 0.65, font: F.sans, size: FS.body, color: C.ink700 });
    txt(s, c.qLabel, { x: c.x, y: colY + 1.25, w: colW, h: 0.3, font: F.sans, bold: true, size: FS.small, color: C.ink500 });
    txt(s, c.query, { x: c.x, y: colY + 1.55, w: colW, h: 0.35, font: F.code, size: FS.code, color: C.ink950 });
    txt(s, c.match, { x: c.x, y: colY + 2.0, w: colW, h: 0.75, font: F.sans, size: FS.small, color: C.ink700 });
    txt(s, c.verdict, { x: c.x, y: colY + 2.95, w: colW, h: 0.4, font: F.sans, bold: true, size: FS.small, color: C.accent });
  });
  line(s, MARGIN + colW + 0.4, colY, MARGIN + colW + 0.4, colY + 3.35, { color: C.ink200, width: 1 });

  hrule(s, MARGIN, colY + 3.55, CONTENT_W, { color: C.ink200 });
  txt(s, "Same chunk, two completely different reasons to retrieve it.", { x: MARGIN, y: colY + 3.7, w: CONTENT_W, h: 0.4, font: F.sans, size: FS.body, color: C.ink950 });
  footer(s, 6, 18);
  s.addNotes("Teaches the lexical/semantic distinction with one shared example chunk and two different queries, before any implementation vocabulary appears.");
}

// ================================================================ SLIDE 7 =
function slide07() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "What is an embedding?");

  txt(s, "An embedding represents text as a list of numbers — a point in space that captures what the text means.", {
    x: MARGIN,
    y: CONTENT_TOP,
    w: CONTENT_W,
    h: 0.6,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  const exY = CONTENT_TOP + 0.9;
  const rows = [
    { text: '"primary key"', vec: "[ 0.12, −0.41, 0.83, … ]" },
    { text: '"unique identifier"', vec: "[ 0.15, −0.38, 0.79, … ]" },
  ];
  rows.forEach((r, i) => {
    const y = exY + i * 0.55;
    txt(s, r.text, { x: MARGIN, y, w: 3.4, h: 0.42, font: F.code, size: FS.code, color: C.ink950, valign: "middle" });
    txt(s, "→", { x: MARGIN + 3.5, y, w: 0.4, h: 0.42, font: F.sans, size: FS.code, color: C.ink500, valign: "middle" });
    txt(s, r.vec, { x: MARGIN + 4.0, y, w: 5, h: 0.42, font: F.code, size: FS.code, color: C.accent, valign: "middle" });
  });
  txt(s, "(conceptual example — not real model output; the actual vectors are 384 numbers long)", {
    x: MARGIN,
    y: exY + 1.2,
    w: CONTENT_W,
    h: 0.3,
    font: F.sans,
    italic: true,
    size: FS.small,
    color: C.ink500,
  });

  hrule(s, MARGIN, exY + 1.7, CONTENT_W, { color: C.ink200 });
  txt(s, "The exact values don’t matter. What matters is the relationship: texts with related meanings end up with nearby representations.", {
    x: MARGIN,
    y: exY + 1.85,
    w: CONTENT_W,
    h: 0.65,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  txt(s, "pgvector lets PostgreSQL store these vectors as a native column type, and compare them directly in SQL.", {
    x: MARGIN,
    y: exY + 2.7,
    w: CONTENT_W,
    h: 0.6,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  hrule(s, MARGIN, exY + 3.45, CONTENT_W, { color: C.ink200 });
  txt(s, "In Within: 384-dimensional, generated locally with all-MiniLM-L6-v2 — no API cost.", {
    x: MARGIN,
    y: exY + 3.6,
    w: CONTENT_W,
    h: 0.35,
    font: F.code,
    size: FS.small,
    color: C.ink700,
  });
  footer(s, 7, 18);
  s.addNotes("Embeddings explained from zero, with clearly-labeled conceptual example vectors, before pgvector or semantic_retrieve() are named.");
}

// ================================================================ SLIDE 8 =
function slide08() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "One query. Four ways to look.");

  const items = [
    { label: "STRUCTURED", icon: "filter", fn: "structured_retrieve()", def: "Uses database fields and filters.", ex: "project, title, date" },
    { label: "FULL-TEXT", icon: "type", fn: "fulltext_retrieve()", def: "Matches words that appear in the text.", ex: "tsvector, ts_rank_cd" },
    { label: "SEMANTIC", icon: "zap", fn: "semantic_retrieve()", def: "Matches meaning using embeddings.", ex: "pgvector, cosine distance" },
    { label: "HYBRID", icon: "gitmerge", fn: "hybrid_retrieve()", def: "Combines multiple rankings into one.", ex: "Reciprocal Rank Fusion", accent: true },
  ];
  const gap = 0.55;
  const colW = (CONTENT_W - gap * 3) / 4;
  const topY = CONTENT_TOP;
  const shift = 0.58;
  items.forEach((it, i) => {
    const x = MARGIN + i * (colW + gap);
    if (i > 0) line(s, x - gap / 2, topY, x - gap / 2, 6.5, { color: C.ink200, width: 1 });
    iconBadge(s, x, topY, 0.42, it.icon, { bg: it.accent ? C.accent : C.accentSoft, iconColor: it.accent ? "white" : "blue" });
    txt(s, it.label, { x, y: topY + shift, w: colW, h: 0.5, font: F.sans, bold: true, size: 21, color: it.accent ? C.accent : C.ink950 });
    hrule(s, x, topY + shift + 0.58, colW, { color: C.ink200 });
    txt(s, it.def, { x, y: topY + shift + 0.74, w: colW, h: 1.0, font: F.sans, size: 16.5, color: C.ink700 });
    txt(s, it.fn, { x, y: topY + shift + 1.85, w: colW, h: 0.5, font: F.code, size: FS.small - 2, color: C.ink500 });
    txt(s, it.ex, { x, y: topY + shift + 2.5, w: colW, h: 0.5, font: F.code, size: FS.small - 2, color: it.accent ? C.accent : C.ink500 });
  });

  hrule(s, MARGIN, 6.65, CONTENT_W, { color: C.ink200 });
  txt(s, "retrieval.py implements all four as separate, inspectable functions — you can watch them disagree.", {
    x: MARGIN,
    y: 6.8,
    w: CONTENT_W,
    h: 0.35,
    font: F.sans,
    size: FS.small,
    color: C.ink700,
  });
  footer(s, 8, 18);
  s.addNotes("Beginner definition is the visually dominant element in each column; function names and field examples are smaller supporting detail.");
}

// ================================================================ SLIDE 9 =
function slide09() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "Different searches disagree.");
  txt(s, "“how do you uniquely identify a row in a table”", { x: MARGIN, y: CONTENT_TOP - 0.1, w: CONTENT_W, h: 0.35, font: F.code, size: FS.code, color: C.ink500 });

  const colW = 5.35;
  const leftX = MARGIN,
    rightX = PAGE_W - MARGIN - colW;
  const topY = CONTENT_TOP + 0.4;

  [
    ["FULL-TEXT", leftX],
    ["SEMANTIC", rightX],
  ].forEach(([label, x]) => {
    txt(s, label, { x, y: topY, w: colW, h: 0.38, font: F.sans, bold: true, size: FS.label - 6, color: C.ink950, tracking: 0.6 });
    hrule(s, x, topY + 0.46, colW, { color: C.ink200 });
  });

  const ft = [{ rank: 1, id: 64, text: "A relation is commonly represented as a table" }];
  const sem = [
    { rank: 1, id: 61, text: "Here, each row represents a student record" },
    { rank: 2, id: 65, text: "For example, consider the Student table" },
    { rank: 3, id: 63, text: "In a relational database" },
    { rank: 4, id: 64, text: "A relation is commonly represented as a table" },
    { rank: 5, id: 67, text: "Student_ID can be the primary key" },
  ];
  const rowH = 0.52;
  function rankRow(x, y, item) {
    const hi = item.id === 64;
    const d = 0.34;
    if (hi) {
      citationCircle(s, x, y + (rowH - d) / 2, d, item.rank, { fill: C.accent, size: 12 });
    } else {
      s.addShape("ellipse", { x, y: y + (rowH - d) / 2, w: d, h: d, fill: { type: "none" }, line: { color: C.ink300, width: 1 } });
      txt(s, String(item.rank), { x, y: y + (rowH - d) / 2 - 0.01, w: d, h: d, font: F.sans, bold: true, size: 12, color: C.ink300, align: "center", valign: "middle" });
    }
    txt(s, `chunk ${item.id}`, { x: x + 0.55, y, w: 1.55, h: rowH, font: F.code, bold: hi, size: FS.code, color: hi ? C.accent : C.ink700, valign: "middle" });
    txt(s, item.text, { x: x + 2.15, y, w: colW - 2.15, h: rowH, font: F.sans, size: FS.small, color: hi ? C.ink950 : C.ink700, valign: "middle" });
  }

  let y = topY + 0.6;
  ft.forEach((item) => rankRow(leftX, y, item));
  txt(s, "(one exact-token match)", { x: leftX + 0.65, y: y + rowH, w: colW, h: 0.3, font: F.sans, size: FS.small - 1, color: C.ink300 });
  const leftLineY = y + rowH / 2;

  y = topY + 0.6;
  let rightLineY = null;
  sem.forEach((item) => {
    rankRow(rightX, y, item);
    if (item.id === 64) rightLineY = y + rowH / 2;
    y += rowH;
  });

  if (rightLineY != null) {
    line(s, leftX + colW, leftLineY, rightX, leftLineY, { color: C.accent, width: 1.25, dash: "dash" });
    line(s, rightX, leftLineY, rightX, rightLineY, { color: C.accent, width: 1.25, dash: "dash" });
  }

  txt(s, "chunk 64 — #1 in full-text, #4 in semantic. Same evidence, different rank.", {
    x: MARGIN,
    y: 5.7,
    w: CONTENT_W,
    h: 0.35,
    font: F.sans,
    bold: true,
    size: FS.small,
    color: C.accent,
  });

  hrule(s, MARGIN, 6.25, CONTENT_W, { color: C.ink200 });
  txt(s, "Full-text rewards matching words; semantic rewards related meaning. Neither is wrong.", {
    x: MARGIN,
    y: 6.4,
    w: CONTENT_W,
    h: 0.35,
    font: F.sans,
    size: FS.body,
    color: C.ink950,
  });
  footer(s, 9, 18);
  s.addNotes("Real output from /retrieve/fulltext and /retrieve/semantic for the same query. Sets up hybrid retrieval as the next, necessary step.");
}

// =============================================================== SLIDE 10 =
function slide10() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "How do we combine them?");

  txt(s, "Instead of trying to compare two different score scales, we use each search method’s position in its ranking: 1st, 2nd, 3rd…", {
    x: MARGIN,
    y: CONTENT_TOP,
    w: CONTENT_W,
    h: 0.7,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  const leftX = MARGIN + 1.4,
    rightX = PAGE_W - MARGIN - 1.4 - 3.0;
  const topY = CONTENT_TOP + 1.05;
  txt(s, "FULL-TEXT\nRANKING", { x: leftX - 1.4, y: topY, w: 2.8, h: 0.75, font: F.sans, bold: true, size: FS.label - 4, color: C.ink950, align: "center" });
  txt(s, "SEMANTIC\nRANKING", { x: rightX - 1.4, y: topY, w: 2.8, h: 0.75, font: F.sans, bold: true, size: FS.label - 4, color: C.ink950, align: "center" });

  const mergeY = topY + 1.05;
  const centerX = PAGE_W / 2;
  line(s, leftX, topY + 0.75, leftX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, leftX, mergeY, centerX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, rightX, topY + 0.75, rightX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, rightX, mergeY, centerX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, centerX, mergeY, centerX, mergeY + 0.22, { color: C.ink500, width: 1.25 });

  txt(s, "COMBINED RANKING", { x: centerX - 2.2, y: mergeY + 0.32, w: 4.4, h: 0.4, font: F.sans, bold: true, size: FS.label - 4, color: C.accent, align: "center" });

  hrule(s, MARGIN, mergeY + 0.95, CONTENT_W, { color: C.ink200 });
  txt(s, "Reciprocal Rank Fusion: documents that rank highly across multiple lists receive a stronger combined position.", {
    x: MARGIN,
    y: mergeY + 1.1,
    w: CONTENT_W,
    h: 0.6,
    font: F.sans,
    size: FS.body,
    color: C.ink950,
  });
  footer(s, 10, 18);
  s.addNotes("RRF explained as a concept first — rank-based fusion — with no equation yet. The equation and real numbers come on the next slide.");
}

// =============================================================== SLIDE 11 =
function slide11() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "One chunk. Two rankings. One fused result.");

  const leftX = MARGIN,
    rightX = PAGE_W - MARGIN - 3.1;
  const colW = 3.1;
  const topY = CONTENT_TOP;

  txt(s, "FULL-TEXT", { x: leftX, y: topY, w: colW, h: 0.32, font: F.sans, bold: true, size: FS.small, color: C.ink950, tracking: 0.5 });
  txt(s, "SEMANTIC", { x: rightX, y: topY, w: colW, h: 0.32, font: F.sans, bold: true, size: FS.small, color: C.ink950, tracking: 0.5 });
  hrule(s, leftX, topY + 0.4, colW, { color: C.ink200 });
  hrule(s, rightX, topY + 0.4, colW, { color: C.ink200 });

  txt(s, "chunk 64 → #1", { x: leftX, y: topY + 0.5, w: colW, h: 0.4, font: F.code, bold: true, size: FS.code, color: C.accent });
  const semList = [
    { id: 61, hi: false },
    { id: 65, hi: false },
    { id: 63, hi: false },
    { id: 64, hi: true },
    { id: 67, hi: false },
  ];
  semList.forEach((r, i) => {
    txt(s, `chunk ${r.id}`, { x: rightX, y: topY + 0.5 + i * 0.4, w: colW, h: 0.4, font: F.code, bold: r.hi, size: FS.code, color: r.hi ? C.accent : C.ink700 });
  });

  const ftBottom = topY + 0.9;
  const semBottom = topY + 0.5 + semList.length * 0.4;
  const mergeY = semBottom + 0.25;
  const centerX = PAGE_W / 2;
  const ftMidX = leftX + colW / 2;
  const semMidX = rightX + colW / 2;

  line(s, ftMidX, ftBottom, ftMidX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, ftMidX, mergeY, centerX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, semMidX, semBottom, semMidX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, semMidX, mergeY, centerX, mergeY, { color: C.ink500, width: 1.25 });
  line(s, centerX, mergeY, centerX, mergeY + 0.18, { color: C.ink500, width: 1.25 });
  txt(s, "RRF", { x: centerX - 0.7, y: mergeY + 0.2, w: 1.4, h: 0.36, font: F.sans, bold: true, size: 19, color: C.ink950, align: "center" });

  txt(s, "score(d) = Σ 1 / (k + rankᵢ(d))", { x: 0, y: mergeY + 0.7, w: PAGE_W, h: 0.5, font: F.sans, size: 30, color: C.ink950, align: "center" });
  txt(s, "k = 60 — controls how strongly rank position affects the score", { x: 0, y: mergeY + 1.24, w: PAGE_W, h: 0.36, font: F.sans, size: FS.small, color: C.accent, align: "center" });
  txt(s, "chunk 64:  1/(60+1) + 1/(60+4) = 0.0320  —  ranked #1 for appearing in both lists", {
    x: 0,
    y: mergeY + 1.68,
    w: PAGE_W,
    h: 0.35,
    font: F.code,
    size: FS.small,
    color: C.ink700,
    align: "center",
  });
  footer(s, 11, 18);
  s.addNotes("Real fused output from /retrieve/hybrid. RRF_K = 60 in retrieval.py. Equation set large — this is the technical centerpiece.");
}

// =============================================================== SLIDE 12 =
function slide12() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "Now ask it.");

  const chain = verticalChain(
    s,
    MARGIN + 0.15,
    CONTENT_TOP,
    [
      { label: "QUESTION", size: FS.label - 2, color: C.ink950 },
      { label: "RETRIEVED EVIDENCE", size: FS.label - 2, color: C.ink950 },
      { label: "LLM", size: FS.label - 2, color: C.ink950 },
      { label: "ANSWER", size: FS.label - 2, color: C.accent },
    ],
    [0.72, 0.72, 0.72],
    { labelGap: 0.38, labelW: 3.9 }
  );
  const noteX = MARGIN + 0.15 + 0.38 + 3.9 + 0.3;
  txt(s, "The LLM receives the relevant evidence. It does not search the entire database itself.", {
    x: noteX,
    y: chain.ys[1] - 0.02,
    w: PAGE_W - MARGIN - noteX,
    h: 0.85,
    font: F.sans,
    size: FS.small,
    color: C.ink700,
  });

  const cardY = chain.bottom + 0.35;
  hrule(s, MARGIN, cardY, CONTENT_W, { color: C.ink200 });
  txt(s, "“What is a primary key in a relational database?”", { x: MARGIN, y: cardY + 0.18, w: CONTENT_W, h: 0.4, font: F.code, size: FS.code, color: C.ink700 });
  txt(
    s,
    [
      { text: "A primary key is an attribute that uniquely identifies each row in a table — for example, Student_ID, because every student has a unique identifier ", options: {} },
      { text: "①", options: { color: C.accent, bold: true } },
      { text: ".", options: {} },
    ],
    { x: MARGIN, y: cardY + 0.68, w: CONTENT_W, h: 0.7, font: F.sans, size: FS.body, color: C.ink950 }
  );
  footer(s, 12, 18);
  s.addNotes("A compact four-step chain makes explicit what the LLM does and does not do, then grounds it with the real question and the real answer's opening sentence.");
}

// =============================================================== SLIDE 13 =
function slide13() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "An answer should be traceable.");

  const x = MARGIN,
    w = CONTENT_W;
  const steps = [
    { label: "ANSWER", body: "“…every record can be distinguished from all others”", mark: "1" },
    { label: "EVIDENCE", body: '"A relation is commonly represented as a table. A tuple represents a row in a table…"  — chunk 64', mono: true },
    { label: "SOURCE", body: "Unit 1  ·  Database Management Systems" },
  ];
  let y = CONTENT_TOP - 0.2;
  const rowH = 1.35;
  steps.forEach((step, i) => {
    txt(s, step.label, { x, y, w: 3, h: 0.32, font: F.sans, bold: true, size: FS.small, color: C.ink500, tracking: 1 });
    hrule(s, x, y + 0.42, w, { color: C.ink200 });
    txt(s, step.body, { x, y: y + 0.56, w, h: 0.65, font: step.mono ? F.code : F.sans, size: step.mono ? FS.code : FS.concept - 8, color: C.ink950 });
    if (i < steps.length - 1) {
      const ly = y + 1.12;
      line(s, x + 0.15, ly, x + 0.15, ly + 0.16, { color: C.ink300, width: 1.25 });
      if (step.mark) citationCircle(s, x + 0.3, ly - 0.06, 0.26, step.mark, { size: 11 });
    }
    y += rowH;
  });

  txt(s, "Every cited claim can be traced back to the retrieved source — it’s a link, not a footnote.", {
    x: MARGIN,
    y: y + 0.1,
    w: CONTENT_W,
    h: 0.4,
    font: F.sans,
    size: FS.body,
    color: C.ink950,
  });
  txt(s, "“Also retrieved”: chunks Within found but didn’t cite stay visible too. Nothing is hidden.", {
    x: MARGIN,
    y: y + 0.65,
    w: CONTENT_W,
    h: 0.35,
    font: F.sans,
    size: FS.small,
    color: C.ink700,
  });
  footer(s, 13, 18);
  s.addNotes("Full-width traceability chain, then two explanation lines — citations as a link back to evidence, plus the 'also retrieved' transparency principle.");
}

// =============================================================== SLIDE 14 =
function slide14() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "Not every question is a retrieval question.");

  txt(s, "“How many chunks does each document have?” This isn’t a question about interpreting text. It’s a question about structured data.", {
    x: MARGIN,
    y: CONTENT_TOP,
    w: CONTENT_W,
    h: 0.5,
    font: F.sans,
    size: FS.body,
    color: C.ink700,
  });

  const cx = PAGE_W / 2;
  const qy = CONTENT_TOP + 0.9;
  txt(s, "QUESTION", { x: cx - 2, y: qy, w: 4, h: 0.4, font: F.sans, bold: true, size: FS.label - 4, color: C.ink950, align: "center", tracking: 1 });
  const trunkTop = qy + 0.5;
  const branchY = trunkTop + 0.85;
  const leftX = cx - 2.8,
    rightX = cx + 2.8;

  line(s, cx, trunkTop, cx, branchY, { color: C.ink300, width: 1.25 });
  line(s, leftX, branchY, rightX, branchY, { color: C.ink300, width: 1.25 });
  line(s, leftX, branchY, leftX, branchY + 0.4, { color: C.ink300, width: 1.25 });
  line(s, rightX, branchY, rightX, branchY + 0.4, { color: C.ink300, width: 1.25 });

  txt(s, "KNOWLEDGE QUESTION", { x: leftX - 1.9, y: branchY + 0.5, w: 3.8, h: 0.55, font: F.sans, bold: true, size: 22, color: C.ink950, align: "center" });
  txt(s, "DATA QUESTION", { x: rightX - 1.9, y: branchY + 0.5, w: 3.8, h: 0.55, font: F.sans, bold: true, size: 22, color: C.accent, align: "center" });
  line(s, leftX, branchY + 1.2, leftX, branchY + 1.5, { color: C.ink300, width: 1.25 });
  line(s, rightX, branchY + 1.2, rightX, branchY + 1.5, { color: C.ink300, width: 1.25 });
  txt(s, "RAG", { x: leftX - 1.9, y: branchY + 1.6, w: 3.8, h: 0.4, font: F.code, bold: true, size: 20, color: C.ink700, align: "center" });
  txt(s, "SQL", { x: rightX - 1.9, y: branchY + 1.6, w: 3.8, h: 0.4, font: F.code, bold: true, size: 20, color: C.accent, align: "center" });

  txt(s, "Find and understand relevant text.", { x: leftX - 1.9, y: branchY + 2.15, w: 3.8, h: 0.4, font: F.sans, size: FS.small, color: C.ink700, align: "center" });
  txt(s, "Filter, join, count, and aggregate structured data.", { x: rightX - 1.9, y: branchY + 2.15, w: 3.8, h: 0.55, font: F.sans, size: FS.small, color: C.ink700, align: "center" });
  footer(s, 14, 18);
  s.addNotes("RAG-vs-SQL fork with a full explanatory sentence under each branch, not just a keyword.");
}

// =============================================================== SLIDE 15 =
function slide15() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "Ask the database directly.");

  txt(s, "“How many chunks does each document have?”", { x: MARGIN, y: CONTENT_TOP - 0.1, w: CONTENT_W, h: 0.4, font: F.code, size: FS.code, color: C.ink500 });

  const sqlX = MARGIN,
    sqlW = CONTENT_W * 0.56;
  const resX = sqlX + sqlW + 0.7,
    resW = CONTENT_W - sqlW - 0.7;
  const topY = CONTENT_TOP + 0.5;

  txt(s, "SQL", { x: sqlX, y: topY, w: sqlW, h: 0.3, font: F.sans, bold: true, size: FS.small, color: C.ink500, tracking: 1 });
  hrule(s, sqlX, topY + 0.4, sqlW, { color: C.ink200 });
  const sqlLines = [
    { t: "SELECT d.id AS document_id,", hi: false },
    { t: "       d.title,", hi: false },
    { t: "       COUNT(dc.id) AS chunk_count", hi: true },
    { t: "FROM documents d", hi: false },
    { t: "LEFT JOIN document_chunks dc", hi: false },
    { t: "  ON dc.document_id = d.id", hi: false },
    { t: "GROUP BY d.id, d.title", hi: true },
    { t: "ORDER BY chunk_count DESC", hi: true },
    { t: "LIMIT 100", hi: false },
  ];
  const sqlY = topY + 0.55;
  const sqlLineH = LH(FS.code) + 0.04;
  sqlLines.forEach((ln, i) => {
    txt(s, ln.t, { x: sqlX, y: sqlY + i * sqlLineH, w: sqlW, h: sqlLineH, font: F.code, size: FS.code, bold: ln.hi, color: ln.hi ? C.accent : C.ink950 });
  });
  const sqlEnd = sqlY + sqlLines.length * sqlLineH;

  txt(s, "RESULT", { x: resX, y: topY, w: resW, h: 0.3, font: F.sans, bold: true, size: FS.small, color: C.ink500, tracking: 1 });
  hrule(s, resX, topY + 0.4, resW, { color: C.ink200 });
  const rows = [
    ["title", "chunks"],
    ["Unit 1", "86"],
    ["EU Customer Data", "60"],
  ];
  let ry = topY + 0.65;
  rows.forEach((row, i) => {
    txt(s, row[0], { x: resX, y: ry, w: resW - 0.9, h: 0.38, font: i === 0 ? F.sans : F.code, bold: i === 0, size: FS.code, color: i === 0 ? C.ink500 : C.ink950 });
    txt(s, row[1], { x: resX + resW - 0.9, y: ry, w: 0.9, h: 0.38, font: i === 0 ? F.sans : F.code, bold: i === 0, size: FS.code, color: i === 0 ? C.ink500 : C.ink950, align: "right" });
    if (i === 0) hrule(s, resX, ry + 0.38, resW, { color: C.ink200 });
    ry += 0.44;
  });

  const noteY = topY + 3.1;
  txt(s, "COUNT() tallies the chunks, GROUP BY groups them per document, ORDER BY ranks the busiest document first.", {
    x: resX,
    y: noteY,
    w: resW,
    h: 1.0,
    font: F.sans,
    size: FS.small,
    color: C.ink700,
  });

  const capY = Math.max(sqlEnd + 0.3, noteY + 0.85);
  hrule(s, MARGIN, capY, CONTENT_W, { color: C.ink200 });
  txt(s, "The model writes the SQL. PostgreSQL performs the calculation.", { x: MARGIN, y: capY + 0.15, w: CONTENT_W, h: 0.4, font: F.sans, size: FS.body, color: C.ink950 });
  footer(s, 15, 18);
  s.addNotes("Real generated SQL and real result rows from POST /nl-sql. Keywords that do the real work (COUNT/GROUP BY/ORDER BY) are highlighted in accent.");
}

// =============================================================== SLIDE 16 =
function slide16() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "The database still has to be safe.");

  const items = [
    { label: "SELECT-only", icon: "shield", body: "Only read queries are allowed. sqlparse checks the statement type before anything runs." },
    { label: "Single statement", icon: "checkcircle", body: "No chained commands. A second statement after a semicolon is rejected outright." },
    { label: "Read-only transaction", icon: "lock", body: "SET LOCAL transaction_read_only = on — the database itself refuses to write." },
    { label: "5-second timeout", icon: "clock", body: "Long-running or runaway queries are stopped automatically." },
  ];
  const gap = 0.5;
  const colW = (CONTENT_W - gap * 3) / 4;
  const topY = CONTENT_TOP;
  const shift = 0.58;
  items.forEach((it, i) => {
    const x = MARGIN + i * (colW + gap);
    if (i > 0) line(s, x - gap / 2, topY, x - gap / 2, 6.1, { color: C.ink200, width: 1 });
    iconBadge(s, x, topY, 0.42, it.icon, { bg: C.accentSoft, iconColor: "blue" });
    txt(s, it.label, { x, y: topY + shift, w: colW, h: 0.85, font: F.sans, bold: true, size: 21, color: C.ink950 });
    hrule(s, x, topY + shift + 0.92, colW, { color: C.ink200 });
    txt(s, it.body, { x, y: topY + shift + 1.08, w: colW, h: 1.8, font: F.sans, size: 16.5, color: C.ink700 });
  });

  hrule(s, MARGIN, 6.2, CONTENT_W, { color: C.ink200 });
  txt(s, "Generated SQL is validated before it ever touches the database. Proven directly: DELETE, chained statements, and queries against tables outside the schema are all rejected.", {
    x: MARGIN,
    y: 6.33,
    w: CONTENT_W,
    h: 0.65,
    font: F.sans,
    size: FS.body,
    color: C.ink950,
  });
  footer(s, 16, 18);
  s.addNotes("Safeguards given a full dedicated slide with real body-sized explanations, not squeezed under the SQL example.");
}

// =============================================================== SLIDE 17 =
function slide17() {
  const s = pres.addSlide();
  bg(s, C.paper);
  header(s, "All of it. One system.");

  const leftX = MARGIN,
    leftW = 2.5;
  const div1X = leftX + leftW + 0.35;
  const centerX = div1X + 0.35,
    centerW = 4.0;
  const div2X = centerX + centerW + 0.35;
  const rightX = div2X + 0.35;
  const rightW = PAGE_W - MARGIN - rightX;
  const topY = CONTENT_TOP,
    bottomY = 6.55;

  line(s, div1X, topY, div1X, bottomY, { color: C.ink200, width: 1 });
  line(s, div2X, topY, div2X, bottomY, { color: C.ink200, width: 1 });

  const spine = [
    { label: "User", icon: "user" },
    { label: "React", icon: "monitor" },
    { label: "FastAPI", icon: "server" },
    { label: "PostgreSQL + pgvector", icon: "database" },
  ];
  const spineTickX = centerX;
  const spineTextX = centerX + 0.62;
  const spineRowH = 1.05;
  line(s, spineTickX, topY + 0.5, spineTickX, topY + (spine.length - 1) * spineRowH + 0.5, { color: C.ink200, width: 1.25 });
  spine.forEach((it, i) => {
    const y = topY + i * spineRowH;
    iconBadge(s, spineTickX - 0.21, y + 0.29, 0.42, it.icon, { bg: C.accentSoft, iconColor: "blue" });
    txt(s, it.label, { x: spineTextX, y: y + 0.32, w: centerW - spineTextX + centerX, h: 0.42, font: F.sans, bold: true, size: 21, color: C.ink950 });
  });

  txt(s, "PIPELINE", { x: leftX, y: topY, w: leftW, h: 0.3, font: F.sans, bold: true, size: FS.small - 1, color: C.ink500, tracking: 1 });
  const leftItems = ["Documents", "Chunks", "Embeddings", "Structured", "Full-text", "Semantic", "Hybrid", "RRF · k=60"];
  const rowH = 0.5;
  leftItems.forEach((label, i) => {
    txt(s, label, { x: leftX, y: topY + 0.4 + i * rowH, w: leftW, h: 0.36, font: F.code, size: FS.code - 1, color: C.ink700 });
  });

  txt(s, "ANSWERS", { x: rightX, y: topY, w: rightW, h: 0.3, font: F.sans, bold: true, size: FS.small - 1, color: C.ink500, tracking: 1 });
  const rightItems = ["RAG", "Citations", "", "NL → SQL", "Validation", "Read-only", "Result"];
  rightItems.forEach((label, i) => {
    if (!label) return;
    txt(s, label, { x: rightX, y: topY + 0.4 + i * rowH, w: rightW, h: 0.36, font: F.code, size: FS.code - 1, color: C.ink700 });
  });

  hrule(s, MARGIN, bottomY + 0.2, CONTENT_W, { color: C.ink200 });
  txt(s, "We’ve been looking at pieces of this the entire time.", { x: 0, y: bottomY + 0.32, w: PAGE_W, h: 0.3, font: F.sans, size: FS.small, color: C.ink500, align: "center" });
  footer(s, 17, 18);
  s.addNotes("Full system reveal: USER → React → FastAPI → PostgreSQL+pgvector, with every capability introduced earlier flanking it. Fills the canvas.");
}

// =============================================================== SLIDE 18 =
function slide18() {
  const s = pres.addSlide();
  bg(s, C.paper);
  txt(s, "Within gives knowledge something to think with.", {
    x: 1.2,
    y: 3.3,
    w: PAGE_W - 2.4,
    h: 1.1,
    font: F.sans,
    bold: true,
    size: FS.title + 4,
    color: C.ink950,
    align: "center",
    valign: "middle",
  });
  footer(s, 18, 18);
  s.addNotes("Close. Low density, high impact — one quiet statement on the product's own paper background, nothing else.");
}

// -------------------------------------------------------------------- run --
slide01();
slide02();
slide03();
slide04();
slide05();
slide06();
slide07();
slide08();
slide09();
slide10();
slide11();
slide12();
slide13();
slide14();
slide15();
slide16();
slide17();
slide18();

pres.writeFile({ fileName: "/Users/syondukea/Software/Projects/Classwork/within/presentation/within.pptx" }).then(() => {
  console.log("written");
});
