# Server status page

[![Deploy on FadeHost](https://img.shields.io/badge/deploy%20on-FadeHost-0ea5e9?style=flat-square)](https://laplace.fadehost.com/bots?new=1)

A public page that shows your game servers: whether each one is up, who is on
it, and the address to join. Give the link to your players so they stop asking
whether the server is down.

- Live status for every server on your account, or only the ones you pick
- Player count and the names of who is online
- The address to join, including your own domain when you have one
- Says "Sleeping, wakes up when someone joins" instead of "offline" for a
  server that is asleep
- Refreshes itself every 30 seconds, dark, and readable on a phone

Your access token stays in the app. Visitors only ever see the page.

## Deploy on FadeHost

1. Open [Apps](https://laplace.fadehost.com/bots) in the panel and choose
   **Host an app**, then the **Server status page** template.
2. Pick the servers you want on the page. A read-only access token is created
   for the app.
3. Turn on the web address and the page is live at
   `https://yourname.fadehost.app`.

## Environment variables

| Variable | Required | What it is |
|---|---|---|
| `FADEHOST_TOKEN` | yes | An access token with the **read** scope, from [Profile, AI Access](https://laplace.fadehost.com/profile/ai-access). Read is enough: the page never starts or stops anything. |
| `SERVER_IDS` | no | Which servers to show, as a comma separated list of `server_…` ids. Leave it empty to show every server on the account. |
| `TITLE` | no | The heading at the top of the page. Defaults to "Server status". |
| `PORT` | no | The port to listen on. FadeHost sets this for you. |

## Run it somewhere else

```bash
npm install
FADEHOST_TOKEN=... TITLE="My network" npm start
```

Then open `http://localhost:8080`. Node 20 or newer.

## Routes

| Route | What it answers |
|---|---|
| `/` | the status page |
| `/api/status` | the same thing as JSON, if you want to build your own front end |
| `/health` | `{ ok, servers, updatedAt }` for uptime checks |

## How it works

The app asks the FadeHost API for your servers every 20 seconds and keeps the
last good answer in memory, so a hundred visitors still make one request. When
FadeHost is briefly unreachable the page keeps showing what it last knew
instead of going blank.

Everything a visitor sees is escaped before it reaches the page, so a player
with an odd name cannot break it.

## Tests

```bash
npm test
```

Built and maintained by [FadeHost](https://fadehost.com). MIT licensed.
