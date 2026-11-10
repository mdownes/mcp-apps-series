# Post 1 — Hello MCP App

The smallest MCP App that works: one tool (`hello`), one `ui://` resource, and a Lit view that renders `structuredContent`.

There is no host in this folder. You test the view with the official basic-host from [ext-apps](https://github.com/modelcontextprotocol/ext-apps).

## Run the server

```bash
npm install
npm run build
npm start
```

The MCP server listens at **http://localhost:3001/mcp**. Leave this terminal running.

`npm run start:stdio` starts the same server over stdio instead, which some desktop clients prefer.

## Test it in the official basic-host

In a second terminal, from a clone of [ext-apps](https://github.com/modelcontextprotocol/ext-apps):

```bash
cd examples/basic-host
npm run start
```

The host defaults to `http://localhost:3001/mcp`. To point it at a different URL:

```bash
SERVERS='["http://localhost:3001/mcp"]' npm run start
```

Open **http://localhost:8080**. Pick the `hello` tool, optionally type a name, and call it. You should see the greeting and time in the sandboxed view.

`examples/basic-host` uses `bun` to serve (`npm run start` runs `bun --watch serve.ts`). If bun is not installed, build the host and serve it with tsx instead:

```bash
npm run build
npx tsx serve.ts
```

## What each file does

| File | Role |
|---|---|
| `server.ts` | The **MCP server**. `registerAppTool` defines `hello` and points `_meta.ui.resourceUri` at the view. The callback returns `content` (text for the model) and `structuredContent` (`{ greeting, time }` for the view). `registerAppResource` serves the built HTML at `ui://hello/view.html`. Listens on Streamable HTTP, or stdio with `--stdio`. |
| `view.ts` | The **view**: a Lit element. `ontoolresult` is registered **before** `app.connect()`, then stores `structuredContent` in `@state() data` so the greeting and time render. |
| `view.html` | The page shell that loads the element. |
| `vite.config.ts` | Bundles the view into one file, `dist/view.html`, with `vite-plugin-singlefile`. That is what the resource returns. |
| `package.json` / `tsconfig.json` | Scripts, dependencies, and Lit decorator settings. |

## Suggested reading order

1. `server.ts` — tool + resource, and why both `content` and `structuredContent` exist
2. `view.ts` — why `ontoolresult` must be set before `connect()`
3. `vite.config.ts` — why the view has to be a single HTML file

The next post adds a button so the view can call the tool itself.
