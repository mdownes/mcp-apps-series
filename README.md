# MCP Apps from scratch

The code files for the MCP-Apps Series of posts on AdvancedFrontends.com.

A hands-on series for [advancedfrontends.com](https://www.advancedfrontends.com). Each post is a small, complete example in its own folder. The goal is to understand MCP Apps well enough to bring one to the site, starting as small as possible.

You will need Node 20+ and npm. These examples use the official [`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) SDK. The shared test host in [`host/`](./host) is a slimmed-down [`examples/basic-host`](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host) from that repo (MIT OR Apache-2.0). Every post reuses it, so one `npm start` builds the view and the host and runs them together.

## Planned posts

1. **[Hello MCP App](./post-1-hello)** — one tool, one `ui://` resource, and a view that renders `structuredContent` from `ontoolresult`
2. **[The view talks back](./post-2-talks-back)** — `callServerTool`, `openLink`, and how host capabilities gate both
3. **[Inside the host](./post-3-inside-the-host)** — the sandbox iframe, the CSP header, and AppBridge
4. **[Theming and host context](./post-4-theming)** — `onhostcontextchanged` and CSS custom properties
5. **[Going live](./post-5-going-live)** — a free deploy, connecting to Claude, and pointing the tool at WordPress posts

## How to use this repo

```bash
git clone https://github.com/mdownes/mcp-apps-series.git
cd mcp-apps-series/post-1-hello
npm install
npm start
```

Open **http://localhost:8080**. The terminal prints that URL when the host is up. The host calls `hello` and shows the greeting in a sandboxed view. Post 2 is the same three commands in `post-2-talks-back`. Later posts reuse the same `host/` folder. Follow the post's README, then read the files in the order it suggests.
