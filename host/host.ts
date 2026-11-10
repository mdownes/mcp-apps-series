// The host (stand-in for Claude or ChatGPT): an MCP client, a tool picker, and an AppBridge to the iframe.
//
// Slimmed down from the official ext-apps basic-host (MIT OR Apache-2.0):
// https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host
import { AppBridge, PostMessageTransport, getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type CallToolResult, type Tool } from "@modelcontextprotocol/client";

const DEFAULT_MCP_URL = "http://localhost:3001/mcp";

const mcpInput = document.querySelector<HTMLInputElement>("#mcp")!;
const toolSelect = document.querySelector<HTMLSelectElement>("#tool")!;
const argsInput = document.querySelector<HTMLInputElement>("#args")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const iframe = document.querySelector<HTMLIFrameElement>("#app")!;
const dark = document.querySelector<HTMLInputElement>("#dark")!;
const theme = (): "dark" | "light" => (dark.checked ? "dark" : "light");

mcpInput.value = new URLSearchParams(location.search).get("server") || DEFAULT_MCP_URL;

let client: Client | undefined;
let tools: Tool[] = [];
let bridge: AppBridge | undefined;

document.querySelector("#connect")!.addEventListener("click", () => connect().catch(showError));
document.querySelector("#call")!.addEventListener("click", () => callSelected().catch(showError));

function showError(err: unknown) {
  statusEl.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
}

function readArgs(): Record<string, unknown> {
  const value: unknown = JSON.parse(argsInput.value || "{}");
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Arguments must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

async function connect() {
  await bridge?.close().catch(() => {});
  bridge = undefined;
  await client?.close().catch(() => {});
  statusEl.textContent = "Connecting…";
  client = new Client({ name: "mcp-apps-test-host", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpInput.value)));
  ({ tools } = await client.listTools());
  toolSelect.replaceChildren(
    ...tools.map((tool) => {
      const option = document.createElement("option");
      option.value = tool.name;
      option.textContent = tool.title || tool.name;
      return option;
    }),
  );
  if (tools.some((tool) => tool.name === "hello")) toolSelect.value = "hello";
  statusEl.textContent = tools.length ? `Connected. ${tools.length} tool(s).` : "Connected. No tools.";
}

async function callSelected() {
  if (!client) await connect();
  const name = toolSelect.value;
  const tool = tools.find((item) => item.name === name);
  if (!tool || !client) {
    statusEl.textContent = "Pick a tool first.";
    return;
  }
  const uri = getToolUiResourceUri(tool);
  if (!uri) {
    statusEl.textContent = `${name} has no ui:// resource.`;
    return;
  }

  const args = readArgs();
  const read = await client.readResource({ uri });
  const content = read.contents[0] as { text?: string; _meta?: { ui?: { csp?: unknown } } };
  const csp = content._meta?.ui?.csp;
  const html = content.text ?? "";

  // "The model decided to call the tool": start the call while the sandbox loads.
  const resultPromise = client.callTool({ name, arguments: args }) as Promise<CallToolResult>;

  const sandboxUrl = `http://localhost:${Number(location.port) + 1}/sandbox.html`;
  const ready = new Promise<void>((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.data?.method === "ui/notifications/sandbox-proxy-ready") {
        removeEventListener("message", onMessage);
        resolve();
      }
    };
    addEventListener("message", onMessage);
  });

  await bridge?.close().catch(() => {});
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  iframe.src = `${sandboxUrl}?csp=${encodeURIComponent(JSON.stringify(csp ?? {}))}`;
  await ready;

  // AppBridge is the host side of the JSON-RPC channel. It forwards tools/call to `client`.
  const caps = client.getServerCapabilities();
  bridge = new AppBridge(
    client,
    { name: "mcp-apps-test-host", version: "0.1.0" },
    { openLinks: {}, serverTools: caps?.tools },
    { hostContext: { theme: theme(), platform: "web", displayMode: "inline" } },
  );
  bridge.onopenlink = async ({ url }) => (window.open(url, "_blank", "noopener"), {});
  bridge.onmessage = async (params) => (console.log("[host] ui/message", params), {});
  dark.onchange = () => bridge?.sendHostContextChange({ theme: theme() });
  const initialized = new Promise<void>((resolve) => {
    bridge!.oninitialized = () => resolve();
  });

  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  await bridge.sendSandboxResourceReady({ html, csp });
  await initialized;
  bridge.sendToolInput({ arguments: args });
  bridge.sendToolResult(await resultPromise);
  statusEl.textContent = `Sent "${name}" to the view.`;
}

await connect();
if (toolSelect.value === "hello") await callSelected();
