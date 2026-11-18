# Post 3 — Inside the host

Post 2's view can `postMessage` its parent. This post is about the box around that view: a sandbox iframe on another origin, a second iframe inside it, and the Content-Security-Policy header. AppBridge is the host's end of the `postMessage` channel.

## Run it

```bash
git clone https://github.com/mdownes/mcp-apps-series.git
cd mcp-apps-series/post-3-inside-the-host
npm install
npm start
```

Open **http://localhost:8080**. `npm start` builds this view and the shared host in [`../host`](../host), then starts the MCP server (http://localhost:3001/mcp) and the host. The host calls `inspect` on load. The frame and the CSP header fill in then. The five probes do not: each result line says **Click to try.** until you press its button, and that button runs only its own check.

## Things to try

1. **Read the frame.** The view's origin is `http://localhost:8081` and its path is `/sandbox.html`. That is the inner iframe. The sandbox proxy wrote this document with `document.write`, and the browser keeps the writer's URL, so the path is the proxy's path rather than a separate address. "Parent is the top window" is **no**. There are two iframes, so `window.parent` (the proxy) is not `window.top` (the host page on port 8080). The proxy origin is readable because the view and the proxy share port 8081. The `sandbox` attribute is `allow-scripts allow-same-origin allow-forms`.
2. **Try to break out.** Three buttons, three blocks. Nothing here runs on load, so the console stays quiet. Each line says **Click to try.** A click runs one check, and the console shows only that check.
   - **Open a tab** calls `window.open`. It returns null. The console says the request was made in a sandboxed frame whose `allow-popups` permission is not set.
   - **Navigate the host** sets `window.top.location.href`. That throws `SecurityError`: `Failed to set a named property 'href' on 'Location': The current window does not have permission to navigate the target frame`. The console says the frame attempting navigation of the top-level window is sandboxed, and neither `allow-top-navigation` nor `allow-top-navigation-by-user-activation` is set. The host page stays on port 8080. `location.assign` is not this check. Chrome refuses to read `assign` on a cross-origin `Location` even when top navigation is allowed, and that call does not navigate.
   - **Read the host page** reads `window.top.document`. That throws `SecurityError`: `Blocked a frame with origin "http://localhost:8081" from accessing a cross-origin frame`. The host page is a different origin, so `allow-same-origin` does not reach it. The second origin is what makes `allow-same-origin` safe: a view on the host's own origin could climb out and remove the sandbox.
3. **Watch the CSP header allow one fetch and block the other.** `server.ts` sets `_meta.ui.csp` with `http://localhost:3001` on both `connectDomains` and `resourceDomains`. [`../host/serve.ts`](../host/serve.ts) copies that onto the `Content-Security-Policy` header of `sandbox.html`. The inner iframe is the proxy document written with `document.write`, so it inherits that header. On load the view fetches the proxy page (same origin, so the console stays quiet) and prints `connect-src 'self' http://localhost:3001` and `img-src 'self' data: http://localhost:3001`. The two fetch lines stay at **Click to try.** until you press them. Each button fetches only its own URL.
   - **Fetch localhost:3001** calls `http://localhost:3001/ping` and shows `{"ok":true,"from":"ping"}`. That origin is in `connectDomains`, and the server sends `Access-Control-Allow-Origin: *`. The console stays quiet.
   - **Fetch 127.0.0.1:3001** calls the same path on the same server. `127.0.0.1` is not the origin we declared, so the header blocks it and the view reports `connect-src`. The console says connecting to `http://127.0.0.1:3001/ping` violates `connect-src 'self' http://localhost:3001`. `connectDomains` is fetch. `resourceDomains` is what landed on `img-src` (and on `script-src` / `style-src`).
4. **Read the AppBridge log.** Open http://localhost:8080/?log=1. A panel under the view lists the `postMessage` traffic: `sandbox-proxy-ready`, `sandbox-resource-ready`, `ui/initialize`, the initialize result, `initialized`, `tool-input`, and `tool-result`. A `size-changed` line is the SDK reporting the view's size. The sandbox on port 8081 relays the view's lines. The two `sandbox-*` lines stay between the host and the proxy. Leave the flag off and the panel stays hidden. That is how posts 1 and 2 use this host.

DevTools on the host page still has a frame dropdown: the host, the sandbox (port 8081), and the inner view. Same three frames as post 2.

## What each file does

| File | Role |
|---|---|
| `server.ts` | The **MCP server**. One tool, `inspect`, and one `ui://` resource. The resource's `_meta.ui.csp` is the allowlist. `GET /ping` is the fetch the view is allowed to make. |
| `view.ts` | The **view**: a native custom element. It reports the frame it is in and the CSP header. Its buttons try the three sandbox escapes and fetch the allowed URL or the blocked one. |
| `view.html` | The page shell. Vite inlines it into `dist/view.html`. |

The host that draws the view lives in [`../host`](../host). The CSP header is built in `serve.ts`, the inner iframe and the relay are in `sandbox.ts`, and AppBridge plus the `?log=1` panel are in `host.ts`.

## Suggested reading order

1. `view.ts` — what this document can see, and what throws
2. `server.ts` — `_meta.ui.csp`, and why both callers of `/ping` are the same server
3. `../host/serve.ts` — the header, from the resource's CSP object
4. `../host/sandbox.ts` — the second iframe, and the `postMessage` relay
5. `../host/host.ts` — `AppBridge`, and the optional log
