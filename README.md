# MCP Apps from scratch

The code files for the MCP-Apps Series of posts on AdvancedFrontends.com.

A hands-on series for [advancedfrontends.com](https://www.advancedfrontends.com). Each post is a small, complete example in its own folder. The goal is to understand MCP Apps well enough to bring one to the site, starting as small as possible.

You will need Node 20+ and npm. These examples use the official [`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) SDK. Test each post with the official `examples/basic-host` from that repo — this series does not ship a host of its own until post 3.

## Planned posts

1. **[Hello MCP App](./post-1-hello)** — one tool, one `ui://` resource, and a view that renders `structuredContent` from `ontoolresult`
2. **[The view talks back](./post-2-view-talks-back)** — `callServerTool`, `openLink`, and how host capabilities gate both
3. **[Inside the host](./post-3-inside-the-host)** — the sandbox iframe, the CSP header, and AppBridge
4. **[Theming and host context](./post-4-theming)** — `onhostcontextchanged` and CSS custom properties
5. **[Going live](./post-5-going-live)** — a free deploy, connecting to Claude, and pointing the tool at WordPress posts

## How to use this repo

Start with post 1. Follow its README, then read the files in the order it suggests. Later posts will land in the folders above as the series is written.
