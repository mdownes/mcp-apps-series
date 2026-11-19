/**
 * Same shape as post 1. The tool only returns a timestamp.
 * Theme, locale, and the rest of the context come from the host, not from this result.
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
const RESOURCE_URI = "ui://theming/view.html";
const VIEW_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist", "view.html");

function createServer() {
  const server = new McpServer({ name: "theming", version: "0.1.0" });

  // The view formats `sample` with the host's locale and time zone.
  // Changing those does not call this tool again.
  registerAppTool(
    server,
    "context",
    {
      title: "Host context",
      description: "Returns a timestamp for the view to format with the host locale and time zone.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        sample: z.string(),
      }),
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async () => {
      const sample = new Date().toISOString();
      return {
        content: [{ type: "text", text: `Sample time ${sample}. The view formats it with the host locale.` }],
        structuredContent: { sample },
      };
    },
  );

  registerAppResource(server, RESOURCE_URI, RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: await fs.readFile(VIEW_PATH, "utf-8"),
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
    }],
  }));

  return server;
}

async function startHttp() {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());
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
