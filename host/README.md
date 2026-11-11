# Test host

A small MCP Apps host so any post in this series can show its view with `npm start`. The page on port **8080** is the host. The sandbox proxy is a separate origin on port **8081**. You do not start this folder yourself: a post's `npm install` installs it, and `npm start` builds and runs it.

This is a slimmed-down version of the official [`examples/basic-host`](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host) from [`@modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps). That example is licensed **MIT OR Apache-2.0**. Post 3 walks through the sandbox iframe, the CSP header, and AppBridge.

## What it does

- Connects to an MCP server. The default is `http://localhost:3001/mcp`. Change the URL on the page, or open `http://localhost:8080/?server=http://localhost:3001/mcp`.
- Lists the server's tools. Pick one, edit the JSON arguments if you need to, and press **Call**.
- On load, calls `hello` if that tool has a view. Otherwise it calls the first tool that has one.
- Reads the tool's `ui://` resource and renders that HTML in a sandboxed iframe. `serve.ts` builds the Content-Security-Policy header from the resource's `_meta.ui.csp`.
- Grants `serverTools` and `openLinks` so a view can call a tool and open a link. Turn one off with `?serverTools=0` or `?openLinks=0`. The check is in `host.ts`.

To run the host on its own after a post has installed it: `npm run build && npm start` in this folder. The terminal prints the URL to open.
