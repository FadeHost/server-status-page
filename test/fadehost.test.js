import test from "node:test";
import assert from "node:assert/strict";

import { addressOf, parseIds, selectServers, stateOf, summarise } from "../lib/fadehost.js";
import { escapeHtml, playerLine, renderCard, renderPage } from "../lib/page.js";

const base = {
  prefixed_id: "server_abc",
  name: "Emberfell",
  status: "Online",
  port: 25565,
  onlinePlayerCount: 2,
  players_sample: ["Notch", "jeb_"],
  slots: 20,
  node: { hostname: "node.example.net", ip: "1.2.3.4", is_byon: false },
  server_software: { game: { name: "Minecraft Java Edition" }, data: { name: "Paper", version: "1.21.8" } },
};

test("addressOf prefers a verified own domain", () => {
  assert.equal(
    addressOf({ ...base, custom_domain: "play.emberfell.gg", custom_domain_verified_at: "2026-09-01T00:00:00Z" }),
    "play.emberfell.gg",
  );
});

test("addressOf ignores an unverified own domain", () => {
  assert.equal(
    addressOf({ ...base, custom_domain: "play.emberfell.gg", custom_domain_verified_at: null }),
    "node.example.net",
  );
});

test("addressOf uses the FadeHost subdomain when there is one", () => {
  const server = { ...base, hostname: { subdomain: "ember", domain: { name: "fadehost.gg" } } };
  assert.equal(addressOf(server), "ember.fadehost.gg");
});

test("addressOf keeps a non-default port", () => {
  assert.equal(addressOf({ ...base, port: 27015 }), "node.example.net:27015");
});

test("addressOf uses the relayed address on a customer-owned node", () => {
  const server = { ...base, node: { ...base.node, is_byon: true }, public_address: "relay.example.net:30001" };
  assert.equal(addressOf(server), "relay.example.net:30001");
});

test("addressOf falls back to the node ip", () => {
  assert.equal(addressOf({ ...base, node: { ip: "1.2.3.4" }, port: 25565 }), "1.2.3.4");
});

test("a stopped server that was put to sleep reads as sleeping", () => {
  const state = stateOf({ ...base, status: "Stopped", hibernated_at: "2026-09-20T10:00:00Z" });
  assert.equal(state.key, "sleeping");
  assert.equal(state.label, "Sleeping");
  assert.match(state.note, /wakes up/i);
});

test("a stopped server that was not put to sleep reads as offline", () => {
  assert.equal(stateOf({ ...base, status: "Stopped", hibernated_at: null }).key, "offline");
});

test("starting and restarting read as busy", () => {
  assert.equal(stateOf({ ...base, status: "Starting" }).key, "busy");
  assert.equal(stateOf({ ...base, status: "Restarting" }).key, "busy");
});

test("summarise keeps only what the page needs", () => {
  const summary = summarise(base);
  assert.equal(summary.name, "Emberfell");
  assert.equal(summary.game, "Minecraft Java Edition");
  assert.equal(summary.software, "Paper 1.21.8");
  assert.equal(summary.address, "node.example.net");
  assert.deepEqual(summary.players, { online: 2, slots: 20, names: ["Notch", "jeb_"], more: 0 });
  // Nothing sensitive rides along.
  assert.equal("rconPassword" in summary, false);
  assert.equal("settings" in summary, false);
});

test("summarise counts the players the sample left out", () => {
  const summary = summarise({ ...base, onlinePlayerCount: 9 });
  assert.equal(summary.players.more, 7);
});

test("selectServers keeps the requested order and drops unknown ids", () => {
  const servers = [{ prefixed_id: "a" }, { prefixed_id: "b" }, { prefixed_id: "c" }];
  assert.deepEqual(
    selectServers(servers, ["c", "a", "zzz"]).map((s) => s.prefixed_id),
    ["c", "a"],
  );
});

test("an empty id list means every server", () => {
  const servers = [{ prefixed_id: "a" }, { prefixed_id: "b" }];
  assert.equal(selectServers(servers, []).length, 2);
});

test("parseIds tolerates spaces and trailing commas", () => {
  assert.deepEqual(parseIds(" server_a , server_b , "), ["server_a", "server_b"]);
  assert.deepEqual(parseIds(undefined), []);
});

test("player names are escaped, not trusted", () => {
  const line = playerLine({ online: 1, slots: null, names: ['<img src=x onerror="alert(1)">'], more: 0 });
  assert.equal(line.includes("<img"), false);
  assert.equal(line.includes("&lt;img"), true);
});

test("a server name cannot inject markup into a card", () => {
  const html = renderCard(summarise({ ...base, name: "<script>alert(1)</script>" }));
  assert.equal(html.includes("<script>alert(1)"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
});

test("escapeHtml handles quotes and ampersands", () => {
  assert.equal(escapeHtml(`a&b"c'd<e>`), "a&amp;b&quot;c&#39;d&lt;e&gt;");
});

test("the page renders the servers it is given", () => {
  const html = renderPage({ title: "Emberfell network", servers: [summarise(base)] });
  assert.match(html, /<title>Emberfell network<\/title>/);
  assert.match(html, /Emberfell/);
  assert.match(html, /node\.example\.net/);
  assert.match(html, /2 \/ 20 players/);
});

test("the page says so when there is nothing to show", () => {
  assert.match(renderPage({ title: "x", servers: [] }), /No servers to show yet/);
});

test("the page shows an error instead of an empty grid", () => {
  const html = renderPage({ title: "x", servers: [], error: "FadeHost rejected the token." });
  assert.match(html, /FadeHost rejected the token/);
});
