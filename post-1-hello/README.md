# Post 1 — Hello MCP App

The smallest MCP App that works: one tool (`hello`), one `ui://` resource, and a Lit view that renders `structuredContent`.

## Run it

```bash
git clone https://github.com/mdownes/mcp-apps-series.git
cd mcp-apps-series/post-1-hello
npm install
npm start
```

Open **http://localhost:8080**. `npm install` also installs the shared test host in [`../host`](../host). `npm start` builds this view and that host, then starts the MCP server (http://localhost:3001/mcp) and the host together. The terminal prints the URL to open. The host calls `hello` on load, so the sandboxed view shows **Hello, world!**. Press **Call** to run it again. To greet someone else, set Arguments to `{"name":"Ada"}` and press **Call**.

`npm run start:stdio` starts only the MCP server over stdio, which some desktop clients prefer.

## What each file does

| File | Role |
|---|---|
| `server.ts` | The **MCP server**. `registerAppTool` defines `hello` and points `_meta.ui.resourceUri` at the view. The callback returns `content` (text for the model) and `structuredContent` (`{ greeting, time }` for the view). `registerAppResource` serves the built HTML at `ui://hello/view.html`. Listens on Streamable HTTP, or stdio with `--stdio`. |
| `view.ts` | The **view**: a Lit element. `ontoolresult` is registered **before** `app.connect()`, then stores `structuredContent` in `@state() data` so the greeting and time render. |
| `view.html` | The page shell that loads the element. |
| `vite.config.ts` | Bundles the view into one file, `dist/view.html`, with `vite-plugin-singlefile`. That is what the resource returns. |
| `package.json` / `tsconfig.json` | Scripts, dependencies, and Lit decorator settings. |

The host that draws the view lives in [`../host`](../host), not in this folder. Later posts start that same host. Post 3 explains how it works.

## Suggested reading order

1. `server.ts` — tool + resource, and why both `content` and `structuredContent` exist
2. `view.ts` — why `ontoolresult` must be set before `connect()`
3. `vite.config.ts` — why the view has to be a single HTML file

The next post adds a button so the view can call the tool itself.
