# Post 2 — The view talks back

Post 1 only receives a tool result. This view can start two things itself: call a server tool, and ask the host to open a link. The host's capabilities decide whether either is allowed.

## Run it

```bash
git clone https://github.com/mdownes/mcp-apps-series.git
cd mcp-apps-series/post-2-talks-back
npm install
npm start
```

Open **http://localhost:8080**. `npm start` builds this view and the shared host in [`../host`](../host), then starts the MCP server (http://localhost:3001/mcp) and the host. The host calls `greet` on load, so the sandboxed view shows **Hello, world!** and the note "From the host, via ontoolresult."

## Things to try

1. **Greet again.** Type a name and press **Greet again**. The greeting updates, and the note changes to "From callServerTool. ontoolresult did not run." The return value of `callServerTool` is the reply. The host does not push that result through `ontoolresult`.
2. **Open the link.** Press **Open the spec**. The host opens the MCP Apps spec in a new tab. A popup blocker can still stop the tab; the note says whether the host accepted the request.
3. **Turn a capability off.** Reload with a query flag and press **Call** on the host page if the view does not reload itself:
   - http://localhost:8080/?serverTools=0 disables **Greet again**
   - http://localhost:8080/?openLinks=0 disables **Open the spec**
   The check is `app.getHostCapabilities()` after `connect()`. The same flags are the commented gate in [`../host/host.ts`](../host/host.ts). The host also refuses a tool call when `serverTools` is off, so a view that ignores the check still cannot call the server.
4. **Watch the traffic.** Open DevTools on the host page. The console's frame dropdown lists the host, the sandbox (port 8081), and the inner view. The host frame logs `[host] tools/call from the view` and `[host] openLink`. The inner frame logs `[view] callServerTool` and `[view] openLink`. Those messages are `postMessage` calls the sandbox relays.

## What each file does

| File | Role |
|---|---|
| `server.ts` | The **MCP server**. One tool, `greet`, and one `ui://` resource. The host and the view both call `greet`. |
| `view.ts` | The **view**: a native custom element. `ontoolresult` is registered before `connect()`. After connect it reads host capabilities and disables buttons the host did not grant. |
| `view.html` | The page shell. Vite inlines it into `dist/view.html`. |

The host that draws the view lives in [`../host`](../host). Post 3 explains the sandbox and AppBridge.

## Suggested reading order

1. `view.ts` — three paths: `ontoolresult`, `callServerTool`, `openLink`
2. `server.ts` — why both callers hit the same tool
3. `../host/host.ts` — the `hostCapabilities` object passed to `AppBridge`
