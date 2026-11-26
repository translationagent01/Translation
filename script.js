// ---- CONFIGURATION ----
// Production URL of the "Chat with Assistant" node in n8n.
// Allow your website under "Allowed Origins (CORS)" in that node.
const CONFIG = { chatWebhookUrl: "https://translatioagent01.app.n8n.cloud/webhook/cd4adac3-d5bc-4620-a092-2f917363f60d/chat" };

// ---- SECTIONS AND TASKS ----
const IMG = ".png,.jpg,.jpeg,.webp", DOCS = ".pdf,.docx,.xlsx,.xls,.pptx,.txt,.md,.csv";
const MODES = {
  translation: {
    langs: ["Automatic", "English", "French", "Arabic", "Korean"],
    tasks: [
      { name: "Let the assistant decide", desc: "Describe your request freely", prefix: "", accept: DOCS + "," + IMG,
        ph: "Paste text, ask a question or describe what you need…", send: ["Text, a file or a question"], get: ["The assistant identifies the task and asks if something is unclear"], tip: "Choose a specific task for the most predictable result." },
      { name: "Translate a document", desc: "PDF, Word, Excel, PowerPoint", prefix: "Translate this document.", accept: DOCS,
        ph: "Attach the document, or paste its text here…", send: ["One file: PDF, Word, Excel or PowerPoint", "Or the text pasted directly"], get: ["A complete translation in the same structure", "Technical terms from your glossary"], tip: "For long files, send one document at a time." },
      { name: "Translate an email or letter", desc: "With a short summary", prefix: "Translate this email or letter.", accept: DOCS,
        ph: "Paste the email or letter here…", send: ["The full email text, or the letter as a file"], get: ["The translation", "A short bullet summary of the message"], tip: "Include the whole thread if the context matters." },
      { name: "Translate a screenshot", desc: "Images and scanned pages", prefix: "Translate the text in this screenshot.", accept: IMG,
        ph: "Paste (Ctrl+V) or attach the image. You can add a note…", send: ["One image: PNG or JPG"], get: ["The translation of all readable text in the image"], tip: "A sharp, straight image gives the best result." }
    ]
  }
};

// ---- THEME ----
const root = document.documentElement, themeBtn = document.getElementById("theme"), themeLabel = document.getElementById("themeLabel");
const paintTheme = () => themeLabel.textContent = root.dataset.theme === "dark" ? "Light" : "Dark";
themeBtn.onclick = () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
  paintTheme();
};
paintTheme();

// ---- HELPERS ----
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function render(md){
  const h = esc(md).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const out = []; let tbl = [];
  const flush = () => {
    if (!tbl.length) return;
    const rows = tbl.filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map((r, i) =>
      "<tr>" + r.replace(/^\s*\||\|\s*$/g, "").split("|").map(c => (i ? "<td>" : "<th>") + c.trim() + (i ? "</td>" : "</th>")).join("") + "</tr>");
    out.push("<table>" + rows.join("") + "</table>"); tbl = [];
  };
  for (const l of h.split("\n")) { if (/^\s*\|.*\|\s*$/.test(l)) tbl.push(l); else { flush(); out.push(l); } }
  flush();
  return out.join("\n").replace(/<\/table>\n/g, "</table>");
}
const newId = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();

// ==EXPORT-START==
// ---- EXPORT: rebuild the translation in the same format as the file that was sent ----
const isRtl = s => ((s.match(/[\u0590-\u08FF]/g) || []).length) > ((s.match(/[A-Za-z\u00C0-\u00FF\uAC00-\uD7AF]/g) || []).length);
const X = s => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function parseBlocks(md){
  const blocks = []; let rows = [];
  const flush = () => { if (rows.length) { blocks.push({ t: "table", rows }); rows = []; } };
  for (const l of md.replace(/\r/g, "").split("\n")) {
    if (/^\s*\|.*\|\s*$/.test(l)) { if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(l)) rows.push(l.replace(/^\s*\||\|\s*$/g, "").split("|").map(c => c.trim())); }
    else { flush(); blocks.push({ t: "p", text: l }); }
  }
  flush(); return blocks;
}
const runs = t => t.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(s => s.length > 4 && s.startsWith("**") && s.endsWith("**") ? { b: 1, s: s.slice(2, -2) } : { s });
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function zip(files){ // stored (uncompressed) zip, enough for a .docx
  const enc = new TextEncoder(), chunks = [], central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    chunks.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm); off += 30 + nm.length + sz;
  }
  const csz = central.reduce((a, c) => a + c.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
function docxBlob(md){
  const para = t => {
    if (!t.trim()) return "<w:p/>";
    const r = isRtl(t);
    return "<w:p>" + (r ? "<w:pPr><w:bidi/></w:pPr>" : "") + runs(t).map(x => '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/>' + (x.b ? "<w:b/><w:bCs/>" : "") +
      '<w:sz w:val="22"/><w:szCs w:val="22"/>' + (r ? "<w:rtl/>" : "") + '</w:rPr><w:t xml:space="preserve">' + X(x.s) + "</w:t></w:r>").join("") + "</w:p>";
  };
  const body = parseBlocks(md).map(b => {
    if (b.t === "p") return para(b.text);
    const cols = Math.max(...b.rows.map(r => r.length)), bd = ["top", "left", "bottom", "right", "insideH", "insideV"].map(k => '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="999999"/>').join("");
    return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>' + bd + "</w:tblBorders></w:tblPr><w:tblGrid>" + '<w:gridCol w:w="2000"/>'.repeat(cols) + "</w:tblGrid>" +
      b.rows.map((r, i) => "<w:tr>" + Array.from({ length: cols }, (_, k) => '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>' + para(r[k] ? (i ? r[k] : "**" + r[k].replace(/\*\*/g, "") + "**") : "") + "</w:tc>").join("") + "</w:tr>").join("") + "</w:tbl><w:p/>";
  }).join("");
  const enc = new TextEncoder(), H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zip([
    { name: "[Content_Types].xml", data: enc.encode(H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { name: "_rels/.rels", data: enc.encode(H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { name: "word/document.xml", data: enc.encode(H + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>') }
  ]);
}
async function paint(md, paged){ // draws the translation on canvas pages (A4 shape for PDF, one tall image otherwise)
  if (document.fonts) await document.fonts.ready;
  const W = 1240, H = 1754, M = 90, LH = 40, font = "26px 'IBM Plex Sans','IBM Plex Sans Arabic',Arial,sans-serif";
  const probe = document.createElement("canvas").getContext("2d"); probe.font = font;
  const lines = [];
  for (const raw of parseBlocks(md).flatMap(b => b.t === "table" ? b.rows.map(r => r.join("   |   ")) : [b.text]).map(s => s.replace(/\*\*/g, ""))) {
    if (!raw.trim()) { lines.push({ text: "", rtl: false }); continue; }
    const rtl = isRtl(raw); let cur = "";
    for (const w of raw.split(/\s+/)) { const t = cur ? cur + " " + w : w; if (cur && probe.measureText(t).width > W - 2 * M) { lines.push({ text: cur, rtl }); cur = w; } else cur = t; }
    lines.push({ text: cur, rtl });
  }
  const per = paged ? Math.floor((H - 2 * M) / LH) : Math.max(lines.length, 1), pages = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += per) pages.push(lines.slice(i, i + per));
  return pages.map(p => {
    const c = document.createElement("canvas"); c.width = W; c.height = paged ? H : Math.min(p.length * LH + 2 * M, 16000);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.fillStyle = "#111827"; x.font = font; x.textBaseline = "top";
    p.forEach((l, i) => { x.direction = l.rtl ? "rtl" : "ltr"; x.textAlign = l.rtl ? "right" : "left"; x.fillText(l.text, l.rtl ? W - M : M, M + i * LH); });
    return c;
  });
}
async function pdfFromCanvases(cvs){
  const enc = new TextEncoder(), parts = [], offs = []; let pos = 0;
  const push = x => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (id, fn) => { offs[id] = pos; push(id + " 0 obj\n"); fn(); push("\nendobj\n"); };
  const n = cvs.length;
  push("%PDF-1.4\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push("<< /Type /Pages /Count " + n + " /Kids [" + cvs.map((_, i) => (3 + i * 3) + " 0 R").join(" ") + "] >>"));
  for (let i = 0; i < n; i++) {
    const c = cvs[i], pg = 3 + i * 3, ct = pg + 1, im = pg + 2, content = "q 595 0 0 842 0 0 cm /Im0 Do Q";
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92)), bytes = new Uint8Array(await blob.arrayBuffer());
    obj(pg, () => push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 " + im + " 0 R >> >> /Contents " + ct + " 0 R >>"));
    obj(ct, () => push("<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream"));
    obj(im, () => { push("<< /Type /XObject /Subtype /Image /Width " + c.width + " /Height " + c.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + bytes.length + " >>\nstream\n"); push(bytes); push("\nendstream"); });
  }
  const xr = pos, total = 3 + n * 3;
  push("xref\n0 " + total + "\n0000000000 65535 f \n");
  for (let id = 1; id < total; id++) push(String(offs[id]).padStart(10, "0") + " 00000 n \n");
  push("trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xr + "\n%%EOF");
  return new Blob(parts, { type: "application/pdf" });
}
const imgBlob = async md => new Promise(r => paint(md, false).then(([c]) => c.toBlob(r, "image/png")));
const pdfBlob = async md => pdfFromCanvases(await paint(md, true));
const txtBlob = md => new Blob([md.replace(/\*\*/g, "")], { type: "text/plain;charset=utf-8" });
const kindOf = f => {
  if (!f) return "txt";
  const e = (f.name.split(".").pop() || "").toLowerCase();
  if (e === "docx" || e === "doc") return "docx";
  if (e === "pdf") return "pdf";
  if (f.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(e)) return "img";
  return "txt";
};
const KINDS = { docx: ["Word (.docx)", "docx"], pdf: ["PDF", "pdf"], img: ["Image (PNG)", "png"], txt: ["Text (.txt)", "txt"] };
function save(blob, name){ const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); }
async function exportAs(kind, md, base){
  const blob = kind === "docx" ? docxBlob(md) : kind === "pdf" ? await pdfBlob(md) : kind === "img" ? await imgBlob(md) : txtBlob(md);
  save(blob, base + "-translated." + KINDS[kind][1]);
}
// ==EXPORT-END==

// ==LAYOUT-START==
// ---- WORD FILES: translate inside the original .docx so the layout, tables, images and styles stay as they were ----
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", XML_NS = "http://www.w3.org/XML/1998/namespace";
const rd16 = (d, o) => d.getUint16(o, true), rd32 = (d, o) => d.getUint32(o, true);
async function inflate(bytes){ return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); }
async function unzipAll(buf){
  const d = new DataView(buf), u = new Uint8Array(buf), dec = new TextDecoder(); let e = d.byteLength - 22;
  while (e >= 0 && rd32(d, e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a valid .docx");
  const n = rd16(d, e + 10), out = []; let p = rd32(d, e + 16);
  for (let i = 0; i < n; i++) {
    const method = rd16(d, p + 10), csz = rd32(d, p + 20), nl = rd16(d, p + 28), el = rd16(d, p + 30), cl = rd16(d, p + 32), lo = rd32(d, p + 42);
    const name = dec.decode(u.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    if (name.endsWith("/")) continue;
    const st = lo + 30 + rd16(d, lo + 26) + rd16(d, lo + 28), raw = u.subarray(st, st + csz);
    out.push({ name, data: method === 0 ? raw : await inflate(raw) });
  }
  return out;
}
const isW = (el, ln) => el && el.namespaceURI === W_NS && el.localName === ln;
const nearestP = t => { let a = t.parentNode; while (a && !isW(a, "p")) a = a.parentNode; return a; };
const ownTexts = p => [...p.getElementsByTagNameNS(W_NS, "t")].filter(t => nearestP(t) === p);
const kid = (el, ln) => el && [...el.children].find(c => isW(c, ln));
const PPR_AFTER = ["adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"];
const RPR_AFTER = ["cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath"];
function addOrdered(parent, ln, after){
  const el = parent.ownerDocument.createElementNS(W_NS, "w:" + ln);
  parent.insertBefore(el, [...parent.children].find(c => c.namespaceURI === W_NS && after.includes(c.localName)) || null);
}
function setDirection(p, texts, rtl){
  let ppr = kid(p, "pPr");
  if (rtl && !kid(ppr, "bidi")) { if (!ppr) { ppr = p.ownerDocument.createElementNS(W_NS, "w:pPr"); p.insertBefore(ppr, p.firstChild); } addOrdered(ppr, "bidi", PPR_AFTER); }
  if (!rtl && kid(ppr, "bidi")) ppr.removeChild(kid(ppr, "bidi"));
  for (const r of new Set(texts.map(t => t.parentNode))) {
    let rpr = kid(r, "rPr");
    if (rtl && !kid(rpr, "rtl")) { if (!rpr) { rpr = p.ownerDocument.createElementNS(W_NS, "w:rPr"); r.insertBefore(rpr, r.firstChild); } addOrdered(rpr, "rtl", RPR_AFTER); }
    if (!rtl && kid(rpr, "rtl")) rpr.removeChild(kid(rpr, "rtl"));
  }
}
function putText(p, tr){
  const ts = ownTexts(p);
  ts.forEach((t, i) => { t.textContent = i ? "" : tr; if (!i) t.setAttributeNS(XML_NS, "xml:space", "preserve"); });
  setDirection(p, ts, isRtl(tr));
}
async function layoutDocx(file, langName, ask, progress){
  const entries = await unzipAll(await file.arrayBuffer()), dec = new TextDecoder(), enc = new TextEncoder(), docs = [], items = [];
  for (const e of entries) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(e.name)) continue;
    const dom = new DOMParser().parseFromString(dec.decode(e.data), "application/xml");
    if (dom.getElementsByTagName("parsererror").length) continue;
    docs.push({ e, dom });
    for (const p of dom.getElementsByTagNameNS(W_NS, "p")) { const t = ownTexts(p).map(x => x.textContent).join(""); if (/\p{L}/u.test(t)) items.push({ p, t: t.replace(/\s*\n\s*/g, " ").trim() }); }
  }
  if (!items.length) throw new Error("no text found");
  const batches = []; let cur = [], chars = 0;
  items.forEach((it, i) => { if (cur.length && (cur.length >= 25 || chars + it.t.length > 3500)) { batches.push(cur); cur = []; chars = 0; } cur.push(i); chars += it.t.length; });
  if (cur.length) batches.push(cur);
  let missed = 0;
  for (let b = 0; b < batches.length; b++) {
    progress(b + 1, batches.length);
    const idx = batches[b];
    const reply = await ask("Translate each numbered line below" + (langName ? " into " + langName : "") + ". Return exactly one line per item in the form number|translation, keep the same numbers, and add no notes, headings or blank lines.\n\n" + idx.map((g, k) => (k + 1) + "|" + items[g].t).join("\n"));
    const map = {};
    for (const l of reply.split("\n")) { const m = l.match(/^\s*\**(\d+)\**\s*[|:]\s*(.*)$/); if (m) map[m[1]] = m[2].replace(/\*\*/g, "").trim(); }
    idx.forEach((g, k) => { if (map[k + 1]) putText(items[g].p, map[k + 1]); else missed++; });
  }
  if (missed > items.length * 0.2) throw new Error("the reply was not in the expected format");
  const ser = new XMLSerializer(), changed = new Map(docs.map(d => [d.e.name, enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + ser.serializeToString(d.dom))]));
  return zip(entries.map(e => ({ name: e.name, data: changed.get(e.name) || e.data })));
}
// ==LAYOUT-END==

// ---- WORKSPACE (one per section) ----
function initPanel(panel){
  const mode = MODES[panel.id], box = panel.querySelector(".chat");
  const $ = s => panel.querySelector(s);
  const log = $(".log"), text = $("textarea"), fileIn = $("input[type=file]"), info = $(".file"), sendBtn = $(".send");
  let task = mode.tasks[0], sessionId = newId(), busy = false;

  // task pills and language list
  mode.tasks.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "task"; b.textContent = t.name;
    b.onclick = () => pick(i);
    $(".tasks").appendChild(b);
  });
  mode.langs.forEach((l, i) => $(".lang").add(new Option(i ? l : "Automatic", i ? l : "")));
  const lang = () => $(".lang").value;

  function pick(i){
    task = mode.tasks[i];
    panel.querySelectorAll(".task").forEach((el, j) => el.setAttribute("aria-pressed", i === j));
    $(".hint").textContent = "Send: " + task.send[0] + ". You receive: " + task.get[0].replace(/^./, c => c.toLowerCase()) + ".";
    text.placeholder = task.ph;
    fileIn.accept = task.accept; $(".attach").hidden = !task.accept;
    if (fileIn.files[0] && task.accept) { fileIn.value = ""; fileIn.onchange(); }
    text.focus({ preventScroll: true });
  }

  function add(role, content, html, out){
    const d = document.createElement("div");
    d.className = "msg " + role; d.dir = "auto";
    if (html) d.innerHTML = render(content); else d.textContent = content;
    if (role === "bot" && html) {
      const a = document.createElement("div"); a.className = "acts";
      const btn = (label, fn, primary) => {
        const b = document.createElement("button"); b.type = "button"; b.textContent = label; if (primary) b.className = "main";
        b.onclick = async () => { const old = b.textContent; b.disabled = true; b.textContent = "Preparing…"; try { await fn(); b.textContent = old; } catch (e) { b.textContent = "Failed, try again"; } b.disabled = false; };
        a.appendChild(b); return b;
      };
      const kind = (out && out.kind) || "txt", base = (out && out.name) || "translation";
      btn("Download " + KINDS[kind][0], () => exportAs(kind, content, base), true);
      if (kind !== "txt") btn("Text (.txt)", () => exportAs("txt", content, base));
      btn("Copy", () => navigator.clipboard.writeText(content).then(() => { /* label restored by btn() */ }));
      d.appendChild(a);
      if (kind === "img") imgBlob(content).then(bl => { const im = document.createElement("img"); im.className = "result"; im.alt = "Translated image"; im.src = URL.createObjectURL(bl); d.insertBefore(im, a); log.scrollTop = log.scrollHeight; }).catch(() => {});
    }
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  async function ask(message, sid){
    const res = await fetch(CONFIG.chatWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sendMessage", sessionId: sid, chatInput: message }) });
    if (!res.ok) throw new Error("http " + res.status);
    const data = await res.json();
    return String(data.output ?? data.text ?? JSON.stringify(data));
  }
  function addFile(blob, name, note){
    const d = add("bot", note, false), a = document.createElement("div"); a.className = "acts";
    const b = document.createElement("button"); b.type = "button"; b.className = "main"; b.textContent = "Download Word (.docx)"; b.onclick = () => save(blob, name);
    a.appendChild(b); d.appendChild(a); log.scrollTop = log.scrollHeight;
  }

  const welcome = () => add("bot", box.dataset.welcome, false);

  $(".attach").onclick = () => fileIn.click();
  fileIn.onchange = () => {
    const f = fileIn.files[0];
    info.hidden = !f; info.textContent = "";
    if (f) {
      if (f.type.startsWith("image/")) {
        const im = document.createElement("img"); im.src = URL.createObjectURL(f); im.alt = "Preview of the attached image";
        im.onload = () => URL.revokeObjectURL(im.src); info.appendChild(im);
      }
      info.append("Attached: " + f.name + " ");
      const x = document.createElement("button"); x.type = "button"; x.textContent = "Remove";
      x.onclick = () => { fileIn.value = ""; fileIn.onchange(); };
      info.appendChild(x);
    }
  };
  $(".newc").onclick = () => { log.textContent = ""; sessionId = newId(); text.value = ""; fileIn.value = ""; fileIn.onchange(); welcome(); };

  async function send(){
    if (busy) return;
    const f = fileIn.files[0], typed = text.value.trim();
    if (!typed && !f) { add("bot", "Attach a file or enter your text first, then press Enter to send.", false); text.focus(); return; }
    const l = lang();
    const hint = [task.prefix, l ? "Target language: " + l + "." : ""].filter(Boolean).join(" ");
    const msg = hint + (hint && typed ? "\n\n" : "") + typed;
    add("me", (f ? "[" + f.name + "]\n" : "") + (typed || task.name), false);
    text.value = ""; busy = true; sendBtn.disabled = true;
    const wait = add("bot", "Working on it…", false);
    try {
      if (!CONFIG.chatWebhookUrl || CONFIG.chatWebhookUrl.startsWith("PASTE")) throw new Error("setup");
      if (f && /\.docx$/i.test(f.name)) {
        try {
          const blob = await layoutDocx(f, l, m => ask(m, newId()), (i, n) => { wait.textContent = "Translating the Word file, part " + i + " of " + n + "…"; });
          wait.remove();
          addFile(blob, f.name.replace(/\.[^.]+$/, "") + "-translated.docx", "Your translated Word file is ready. The original layout, tables, images and styles are kept.");
          return;
        } catch (err) { wait.textContent = "Could not keep the original layout (" + err.message + "). Sending the file for a standard translation…"; }
      }
      let res;
      if (f) {
        const fd = new FormData();
        fd.append("action", "sendMessage"); fd.append("sessionId", sessionId); fd.append("chatInput", msg || "Process this file."); fd.append("files", f, f.name);
        res = await fetch(CONFIG.chatWebhookUrl, { method: "POST", body: fd });
      } else {
        res = await fetch(CONFIG.chatWebhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sendMessage", sessionId, chatInput: msg }) });
      }
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      wait.remove();
      add("bot", String(data.output ?? data.text ?? JSON.stringify(data)), true, { kind: kindOf(f), name: f ? f.name.replace(/\.[^.]+$/, "") : "translation" });
    } catch (e) {
      wait.remove();
      add("bot", e.message === "setup"
        ? "The assistant is not connected yet. Set CONFIG.chatWebhookUrl in script.js."
        : "The request failed (" + e.message + "). Check that the workflow is active and that this website is listed under Allowed Origins (CORS) in the chat node, then send again.", false);
    } finally {
      busy = false; sendBtn.disabled = false; fileIn.value = ""; fileIn.onchange();
    }
  }
  sendBtn.onclick = send;
  // Paste a screenshot (Ctrl+V) straight into the chat
  panel.addEventListener("paste", e => {
    const img = [...(e.clipboardData ? e.clipboardData.files : [])].find(f => f.type.startsWith("image/"));
    if (!img) return;                       // normal text paste continues as usual
    e.preventDefault();
    if (!/\.png/.test(task.accept)) pick(mode.tasks.findIndex(t => /screenshot/i.test(t.name)));
    const ext = (img.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const named = new File([img], "screenshot-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + "." + ext, { type: img.type });
    const dt = new DataTransfer(); dt.items.add(named); fileIn.files = dt.files; fileIn.onchange();
    text.focus();
  });
  // Enter sends; Shift+Enter adds a new line
  text.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });

  welcome(); pick(0);
}
document.querySelectorAll(".panel").forEach(initPanel);
