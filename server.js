// A public status page for your FadeHost game servers.
//
// It asks the FadeHost API for your servers every 20 seconds, keeps the last
// good answer in memory, and serves it as a page and as JSON. Visitors never
// reach the API, and the token never leaves this process.

import express from "express";
import { fetchServers, parseIds, selectServers, summarise } from "./lib/fadehost.js";
import { renderPage } from "./lib/page.js";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = (process.env.FADEHOST_TOKEN || "").trim();
const SERVER_IDS = parseIds(process.env.SERVER_IDS);
const TITLE = (process.env.TITLE || "Server status").trim() || "Server status";

// How often we ask FadeHost. The page refreshes every 30 seconds, so a
// 20-second poll keeps it fresh without one request per visitor.
const POLL_MS = 20000;

if (!TOKEN) {
  console.error(
    "[config] FADEHOST_TOKEN is not set. Create a token with the read scope under Profile, AI Access " +
      "(https://laplace.fadehost.com/profile/ai-access), add it as an environment variable and restart.",
  );
  process.exit(1);
}

/** The last thing we know. `error` is only set when we have nothing at all. */
const cache = { servers: [], error: null, updatedAt: null };

async function poll() {
  try {
    const raw = await fetchServers(TOKEN);
    const chosen = selectServers(raw, SERVER_IDS);

    if (SERVER_IDS.length > 0 && chosen.length === 0) {
      cache.error =
        "None of the ids in SERVER_IDS are on this account. " +
        `Known ids: ${raw.map((s) => s.prefixed_id).join(", ") || "none"}.`;
      cache.servers = [];
      return;
    }

    cache.servers = chosen.map(summarise);
    cache.error = null;
    cache.updatedAt = new Date().toISOString();
  } catch (error) {
    console.error(`[poll] ${error.message}`);
    // A page that is already showing servers keeps showing them: a blip at
    // FadeHost is not worth blanking somebody's status page over.
    if (cache.servers.length === 0) cache.error = error.message;
  }
}

const app = express();
app.disable("x-powered-by");
// The app sits behind the FadeHost web address, which terminates TLS.
app.set("trust proxy", true);

app.get("/", (_req, res) => {
  res.type("html").send(
    renderPage({ title: TITLE, servers: cache.servers, error: cache.servers.length ? null : cache.error }),
  );
});

app.get("/api/status", (_req, res) => {
  res.json({
    title: TITLE,
    updatedAt: cache.updatedAt,
    error: cache.servers.length ? null : cache.error,
    servers: cache.servers,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: cache.error === null,
    servers: cache.servers.length,
    updatedAt: cache.updatedAt,
  });
});

await poll();
setInterval(poll, POLL_MS).unref();

// 0.0.0.0, because the web address reaches this container from outside it.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[status-page] listening on ${PORT}`);
  console.log(`[status-page] showing ${cache.servers.length} server(s)`);
  if (process.env.APP_URL) console.log(`[status-page] public address ${process.env.APP_URL}`);
});
