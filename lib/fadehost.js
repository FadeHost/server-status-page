// Everything this app knows about the FadeHost API.
//
// The API answers GET /api/servers with one entry per server the token can
// read. Only a handful of its fields matter for a status page, so the raw
// entry is boiled down to a small, stable shape (`summarise`) that the page
// and the tests both use.

export const API_BASE = process.env.FADEHOST_API || "https://api.fadehost.com/api";

/** Thrown when FadeHost answers with something we cannot use. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch every server the token can see.
 *
 * @param {string} token a FadeHost access token (read scope is enough)
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object[]>}
 */
export async function fetchServers(token, { timeoutMs = 10000 } = {}) {
  const response = await fetch(`${API_BASE}/servers`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(
      "FadeHost rejected the token. Mint a new one under Profile, AI Access, and set it as FADEHOST_TOKEN.",
      response.status,
    );
  }

  if (!response.ok) {
    throw new ApiError(`FadeHost answered ${response.status}.`, response.status);
  }

  const body = await response.json();
  return Array.isArray(body) ? body : [];
}

/**
 * The address players type in.
 *
 * The owner's own domain wins when its DNS has checked out, because the SRV
 * record carries the port and the bare name is what they hand out. Then the
 * FadeHost subdomain, then the relayed address a customer-owned node gets,
 * and finally the node's own hostname with the port.
 *
 * @param {object} server a raw entry from GET /api/servers
 * @returns {string|null}
 */
export function addressOf(server) {
  if (server.custom_domain && server.custom_domain_verified_at) {
    return server.custom_domain;
  }

  if (server.hostname && server.hostname.subdomain && server.hostname.domain) {
    return withPort(`${server.hostname.subdomain}.${server.hostname.domain.name}`, server.port);
  }

  if (server.node?.is_byon && server.public_address) {
    return server.public_address;
  }

  const host = server.node?.hostname || server.node?.ip;
  return host ? withPort(host, server.port) : null;
}

// Minecraft's default port is never typed, so leave it off.
function withPort(host, port) {
  return !port || Number(port) === 25565 ? host : `${host}:${port}`;
}

/**
 * What to show about a server's state.
 *
 * A stopped server that FadeHost put to sleep is not "off": it wakes by
 * itself when somebody joins, and saying "stopped" sends players away.
 *
 * @param {object} server
 * @returns {{key: string, label: string, note: string|null}}
 */
export function stateOf(server) {
  const status = String(server.status || "Unknown");

  if (status === "Stopped" && server.hibernated_at) {
    return { key: "sleeping", label: "Sleeping", note: "Wakes up when someone joins" };
  }

  switch (status) {
    case "Online":
      return { key: "online", label: "Online", note: null };
    case "Starting":
      return { key: "busy", label: "Starting", note: "Give it a moment" };
    case "Restarting":
      return { key: "busy", label: "Restarting", note: "Give it a moment" };
    case "Stopping":
      return { key: "busy", label: "Stopping", note: null };
    case "Stopped":
      return { key: "offline", label: "Offline", note: null };
    default:
      return { key: "offline", label: status, note: null };
  }
}

/**
 * The small, stable shape the page renders.
 *
 * @param {object} server
 */
export function summarise(server) {
  const state = stateOf(server);
  const players = Array.isArray(server.players_sample) ? server.players_sample : [];
  const online = Number(server.onlinePlayerCount || 0);

  return {
    id: server.prefixed_id,
    name: server.name,
    game: server.server_software?.game?.name || "",
    software: [server.server_software?.data?.name, server.server_software?.data?.version]
      .filter(Boolean)
      .join(" "),
    state: state.key,
    stateLabel: state.label,
    stateNote: state.note,
    address: addressOf(server),
    players: {
      online,
      slots: server.slots ? Number(server.slots) : null,
      // The API samples the first few names; the rest are only a count.
      names: players.slice(0, 5),
      more: Math.max(0, online - players.length),
    },
  };
}

/**
 * Keep the servers the owner asked for, in the order they asked for them.
 * An empty list means every server.
 *
 * @param {object[]} servers raw entries
 * @param {string[]} ids prefixed ids
 */
export function selectServers(servers, ids) {
  if (!ids || ids.length === 0) return servers;

  const byId = new Map(servers.map((server) => [server.prefixed_id, server]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Read a comma separated SERVER_IDS value.
 *
 * @param {string|undefined} value
 * @returns {string[]}
 */
export function parseIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}
