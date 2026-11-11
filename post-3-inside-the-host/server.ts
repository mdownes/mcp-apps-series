/**
 * Same shape as post 1, plus a resource that declares _meta.ui.csp.
 * The host turns that object into the CSP header on the sandbox proxy.
 *   npm start            -> this server plus the shared test host
 *   npm run start:stdio  -> stdio only (for local desktop clients)
 */
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 3001);
const RESOURCE_URI = "ui://inside-the-host/view.html";
const VIEW_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist", "view.html");

// connectDomains -> connect-src (fetch). resourceDomains -> script/style/img-src.
// localhost and 127.0.0.1 are different origins. Only localhost is listed,
// so a fetch to 127.0.0.1 is the one the header blocks.
const SERVER_ORIGIN = `http://localhost:${PORT}`;
const CONNECT_DOMAINS = [SERVER_ORIGIN];
const RESOURCE_DOMAINS = [SERVER_ORIGIN];
const ALLOWED_URL = `${SERVER_ORIGIN}/ping`;
const BLOCKED_URL = `http://127.0.0.1:${PORT}/ping`;

function createServer() {
  const server = new McpServer({ name: "inside-the-host", version: "0.1.0" });

  registerAppTool(
    server,
    "inspect",
    {
      title: "Inside the host",
      description: "Returns the CSP origins this view is allowed to use.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        allowedUrl: z.string(),
        blockedUrl: z.string(),
        connectDomains: z.array(z.string()),
        resourceDomains: z.array(z.string()),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async () => ({
      content: [{
        type: "text",
        text: `The view may fetch ${CONNECT_DOMAINS.join(", ")}. Other origins are blocked by the CSP header.`,
      }],
      structuredContent: {
        allowedUrl: ALLOWED_URL,
        blockedUrl: BLOCKED_URL,
        connectDomains: CONNECT_DOMAINS,
        resourceDomains: RESOURCE_DOMAINS,
      },
    }),
  );

  registerAppResource(server, RESOURCE_URI, RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: await fs.readFile(VIEW_PATH, "utf-8"),
      // Read by the host, not by the view. serve.ts copies it onto sandbox.html.
      _meta: {
        ui: {
          csp: {
            connectDomains: CONNECT_DOMAINS,
            resourceDomains: RESOURCE_DOMAINS,
          },
        },
      },
    }],
  }));

  return server;
}

async function startHttp() {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());
  // Same process serves localhost and 127.0.0.1. CSP, not the server, decides
  // which of those names the view is allowed to call.
  app.get("/ping", (_req, res) => {
    res.json({ ok: true, from: "ping" });
  });
  app.all("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.listen(PORT, () => console.log(`MCP server: http://localhost:${PORT}/mcp`));
}

async function startStdio() {
  await createServer().connect(new StdioServerTransport());
}

if (process.argv.includes("--stdio")) {
  await startStdio();
} else {
  await startHttp();
}
