/**
 * Same shape as post 1, plus a view that calls this tool itself.
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
const RESOURCE_URI = "ui://talks-back/view.html";
const VIEW_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist", "view.html");

function createServer() {
  const server = new McpServer({ name: "talks-back", version: "0.1.0" });

  // One tool. The host calls it to open the view. The view calls it again
  // with callServerTool. Both paths hit this function; the difference is
  // who receives the result (ontoolresult vs the returned promise).
  registerAppTool(
    server,
    "greet",
    {
      title: "Greet",
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
