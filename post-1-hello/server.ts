/**
 * MCP server with one tool and one ui:// resource.
 *   npm run build && npm start          -> http://localhost:3001/mcp
 *   npm run start:stdio                 -> stdio (for local desktop clients)
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
const RESOURCE_URI = "ui://hello/view.html";
const VIEW_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist", "view.html");

function createServer() {
  const server = new McpServer({ name: "hello-mcp-app", version: "0.1.0" });

  // 1) The TOOL. _meta.ui.resourceUri tells the host "render this UI for my result".
  //    content is for the model. structuredContent is for the view.
  registerAppTool(
    server,
    "hello",
    {
      title: "Hello",
      description: "Returns a greeting and the current server time.",
      inputSchema: z.object({
        name: z.string().optional().describe("Name to greet. Defaults to 'world'."),
      }),
      outputSchema: z.object({
        greeting: z.string(),
        time: z.string(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ name }) => {
      const who = name?.trim() || "world";
      const time = new Date().toISOString();
      const greeting = `Hello, ${who}!`;
      return {
        content: [{ type: "text", text: `${greeting} The time is ${time}.` }],
        structuredContent: { greeting, time },
      };
    },
  );

  // 2) The ui:// RESOURCE: the single HTML file Vite built into dist/view.html.
  registerAppResource(server, RESOURCE_URI, RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: await fs.readFile(VIEW_PATH, "utf-8"),
      // The view loads nothing external (data arrives via the host), so declare no domains.
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
    }],
  }));

  return server;
}

async function startHttp() {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());
  // Stateless Streamable HTTP: a fresh server + transport per request.
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
