// The page itself: one dark, phone-friendly HTML document with a little
// script that refreshes the cards from /api/status every 30 seconds.

/** Escape text for HTML. Server names and player names come from players. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 40px 20px 64px;
  background: #0b0b0f;
  color: #e7e7ea;
  font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
.wrap { max-width: 820px; margin: 0 auto; }
h1 { font-size: 26px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
.sub { color: #8b8b95; font-size: 14px; margin: 0 0 28px; }
.grid { display: grid; gap: 14px; }
.card {
  background: #131318;
  border: 1px solid #23232c;
  border-radius: 14px;
  padding: 18px 18px 16px;
}
.card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.card-state { text-align: right; flex: none; max-width: 46%; }
.name { font-size: 18px; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
.game { color: #8b8b95; font-size: 13px; margin: 2px 0 0; }
.pill {
  display: inline-flex; align-items: center; gap: 7px;
  white-space: nowrap; flex: none;
  font-size: 13px; font-weight: 500;
  padding: 5px 11px; border-radius: 999px;
  border: 1px solid transparent;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
.pill.online   { color: #4ade80; background: #4ade801a; border-color: #4ade8033; }
.pill.sleeping { color: #a5b4fc; background: #a5b4fc1a; border-color: #a5b4fc33; }
.pill.busy     { color: #fbbf24; background: #fbbf241a; border-color: #fbbf2433; }
.pill.offline  { color: #9ca3af; background: #9ca3af14; border-color: #9ca3af2b; }
.rows { margin: 16px 0 0; display: grid; gap: 9px; }
.row { display: flex; gap: 12px; font-size: 14px; align-items: baseline; }
.row dt { color: #8b8b95; flex: none; width: 78px; margin: 0; }
.row dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
code {
  font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #1d1d24; padding: 3px 7px; border-radius: 6px;
}
.names { color: #c9c9d1; }
.note { color: #8b8b95; font-size: 13px; }
.empty, .error {
  border: 1px dashed #2c2c36; border-radius: 14px;
  padding: 26px; text-align: center; color: #8b8b95;
}
.error { border-color: #7f1d1d; color: #fca5a5; }
footer { margin-top: 32px; text-align: center; color: #6b6b75; font-size: 13px; }
footer a { color: #8b8b95; }
@media (max-width: 480px) {
  body { padding: 28px 14px 48px; }
  .row { display: block; }
  .row dt { width: auto; margin-bottom: 1px; }
}
`;

const SCRIPT = `
const box = document.getElementById("servers");

function pill(s) {
  const note = s.stateNote ? '<p class="note" style="margin:6px 0 0">' + esc(s.stateNote) + "</p>" : "";
  return '<span class="pill ' + esc(s.state) + '"><span class="dot"></span>' + esc(s.stateLabel) + "</span>" + note;
}

function esc(v) {
  return String(v == null ? "" : v)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function playerLine(p) {
  if (p.online === 0) return "Nobody online right now";
  const count = p.online + (p.slots ? " / " + p.slots : "") + (p.online === 1 ? " player" : " players");
  if (p.names.length === 0) return count;
  const names = p.names.map(esc).join(", ") + (p.more > 0 ? " and " + p.more + " more" : "");
  return count + ' <span class="names">(' + names + ")</span>";
}

function card(s) {
  const rows = [];
  if (s.address) rows.push(["Address", "<code>" + esc(s.address) + "</code>"]);
  if (s.state === "online" || s.players.online > 0) rows.push(["Players", playerLine(s.players)]);
  if (s.software) rows.push(["Running", esc(s.software)]);

  return '<article class="card"><div class="card-top"><div>' +
    '<h2 class="name">' + esc(s.name) + "</h2>" +
    (s.game ? '<p class="game">' + esc(s.game) + "</p>" : "") +
    '</div><div class="card-state">' + pill(s) + "</div></div>" +
    (rows.length ? '<dl class="rows">' + rows.map(function (r) {
      return '<div class="row"><dt>' + r[0] + "</dt><dd>" + r[1] + "</dd></div>";
    }).join("") + "</dl>" : "") +
    "</article>";
}

async function refresh() {
  try {
    const res = await fetch("/api/status", { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (data.error) {
      box.innerHTML = '<div class="error">' + esc(data.error) + "</div>";
      return;
    }
    box.innerHTML = data.servers.length
      ? data.servers.map(card).join("")
      : '<div class="empty">No servers to show yet.</div>';
  } catch (e) {
    // A blip should not blank a page that is already showing something useful.
  }
}

setInterval(refresh, 30000);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") refresh();
});
`;

/**
 * Render the whole document. The first paint carries the servers we already
 * have, so the page is useful before any JavaScript runs.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {object[]} options.servers summarised servers
 * @param {string|null} [options.error]
 */
export function renderPage({ title, servers, error = null }) {
  const body = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : servers.length === 0
      ? '<div class="empty">No servers to show yet.</div>'
      : servers.map(renderCard).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="Live status for ${escapeHtml(title)}.">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">Updates every 30 seconds.</p>
  <div class="grid" id="servers">${body}</div>
  <footer>Hosted on <a href="https://fadehost.com" rel="noreferrer">FadeHost</a></footer>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
}

/** One server card, matching what the browser script builds. */
export function renderCard(server) {
  const rows = [];
  if (server.address) rows.push(["Address", `<code>${escapeHtml(server.address)}</code>`]);
  if (server.state === "online" || server.players.online > 0) {
    rows.push(["Players", playerLine(server.players)]);
  }
  if (server.software) rows.push(["Running", escapeHtml(server.software)]);

  const note = server.stateNote
    ? `<p class="note" style="margin:6px 0 0">${escapeHtml(server.stateNote)}</p>`
    : "";

  return `<article class="card"><div class="card-top"><div>` +
    `<h2 class="name">${escapeHtml(server.name)}</h2>` +
    (server.game ? `<p class="game">${escapeHtml(server.game)}</p>` : "") +
    `</div><div class="card-state"><span class="pill ${escapeHtml(server.state)}"><span class="dot"></span>` +
    `${escapeHtml(server.stateLabel)}</span>${note}</div></div>` +
    (rows.length
      ? `<dl class="rows">${rows.map(([k, v]) => `<div class="row"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`
      : "") +
    `</article>`;
}

/** "3 / 20 players (Notch, jeb_ and 1 more)" */
export function playerLine(players) {
  if (players.online === 0) return "Nobody online right now";

  const count =
    `${players.online}${players.slots ? ` / ${players.slots}` : ""}` +
    (players.online === 1 ? " player" : " players");

  if (players.names.length === 0) return count;

  const names =
    players.names.map(escapeHtml).join(", ") +
    (players.more > 0 ? ` and ${players.more} more` : "");

  return `${count} <span class="names">(${names})</span>`;
}
