// The host (stand-in for Claude or ChatGPT): an MCP client, a tool picker, and an AppBridge to the iframe.
//
// Slimmed down from the official ext-apps basic-host (MIT OR Apache-2.0):
// https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host
import { AppBridge, PostMessageTransport, getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type CallToolResult, type JSONRPCMessage, type Tool, type TransportSendOptions } from "@modelcontextprotocol/client";

const DEFAULT_MCP_URL = "http://localhost:3001/mcp";

const mcpInput = document.querySelector<HTMLInputElement>("#mcp")!;
const toolSelect = document.querySelector<HTMLSelectElement>("#tool")!;
const argsInput = document.querySelector<HTMLInputElement>("#args")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const iframe = document.querySelector<HTMLIFrameElement>("#app")!;
const dark = document.querySelector<HTMLInputElement>("#dark")!;
const theme = (): "dark" | "light" => (dark.checked ? "dark" : "light");

const query = new URLSearchParams(location.search);
mcpInput.value = query.get("server") || DEFAULT_MCP_URL;

// Post 3 opt-in. ?log=1 lists AppBridge postMessage traffic on the page.
// Without the flag the panel stays hidden, so posts 1 and 2 look the same.
const logEnabled = query.get("log") === "1";
const trafficEl = document.querySelector<HTMLElement>("#traffic");
const logEl = document.querySelector<HTMLPreElement>("#log");
const methodsById = new Map<string, string>();
if (logEnabled && trafficEl) trafficEl.hidden = false;

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
  // Post 1's tool is named hello. Later posts use another name; open the first tool that has a view.
  const preferred = tools.find((tool) => tool.name === "hello" && getToolUiResourceUri(tool))
    ?? tools.find((tool) => getToolUiResourceUri(tool));
  if (preferred) toolSelect.value = preferred.name;
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
  if (logEl) logEl.textContent = "";
  methodsById.clear();
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  iframe.src = `${sandboxUrl}?csp=${encodeURIComponent(JSON.stringify(csp ?? {}))}`;
  await ready;

  // AppBridge is the host side of the JSON-RPC channel. It forwards tools/call to `client`.
  // Capabilities are the security gate: the view can only do what we list here.
  // Try http://localhost:8080/?serverTools=0 or ?openLinks=0, then press Call.
  const caps = client.getServerCapabilities();
  const hostCapabilities = {
    ...(query.get("openLinks") === "0" ? {} : { openLinks: {} }),
    ...(query.get("serverTools") === "0" || !caps?.tools ? {} : { serverTools: caps.tools }),
  };
  console.log("[host] capabilities", {
    serverTools: Boolean(hostCapabilities.serverTools),
    openLinks: Boolean(hostCapabilities.openLinks),
  });
  bridge = new AppBridge(
    client,
    { name: "mcp-apps-test-host", version: "0.1.0" },
    hostCapabilities,
    { hostContext: { theme: theme(), platform: "web", displayMode: "inline" } },
  );
  if (hostCapabilities.openLinks) {
    bridge.onopenlink = async ({ url }) => {
      console.log("[host] openLink", url);
      window.open(url, "_blank", "noopener");
      return {};
    };
  }
  bridge.onmessage = async (params) => (console.log("[host] ui/message", params), {});
  dark.onchange = () => bridge?.sendHostContextChange({ theme: theme() });
  const initialized = new Promise<void>((resolve) => {
    bridge!.oninitialized = () => resolve();
  });

  // ?log=1 wraps the transport so outgoing postMessage is listed too.
  // The default path is the plain transport posts 1 and 2 already use.
  const frame = iframe.contentWindow!;
  const transport = logEnabled ? new LoggingTransport(frame, frame) : new PostMessageTransport(frame, frame);
  await bridge.connect(transport);
  // connect() forwards tools/call whenever the server has tools. Take that
  // away when this host did not grant serverTools.
  if (hostCapabilities.serverTools) {
    const forward = bridge.oncalltool;
    bridge.oncalltool = async (params, extra) => {
      console.log("[host] tools/call from the view", params.name);
      return forward!(params, extra);
    };
  } else {
    bridge.oncalltool = async () => {
      throw new Error("This host has not granted serverTools.");
    };
  }
  await bridge.sendSandboxResourceReady({ html, csp });
  await initialized;
  bridge.sendToolInput({ arguments: args });
  bridge.sendToolResult(await resultPromise);
  const withheld = [
    hostCapabilities.serverTools ? "" : "serverTools off",
    hostCapabilities.openLinks ? "" : "openLinks off",
  ].filter(Boolean);
  statusEl.textContent = withheld.length
    ? `Sent "${name}" to the view. ${withheld.join(", ")}.`
    : `Sent "${name}" to the view.`;
}

// Same send() as PostMessageTransport, plus one line in the log panel.
// Declared before the top-level await so ?log=1 can construct it during the first call.
class LoggingTransport extends PostMessageTransport {
  override async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    const method = "method" in message && typeof message.method === "string" ? message.method : undefined;
    const direction = method?.startsWith("ui/notifications/sandbox-") ? "host -> sandbox" : "host -> view";
    appendTraffic(direction, message);
    return super.send(message, options);
  }
}

// Incoming postMessage (sandbox -> host, and the view's messages after the
// proxy relays them). Outgoing messages are recorded by LoggingTransport.
if (logEnabled) {
  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow || !isRpc(event.data)) return;
    const method = typeof event.data.method === "string" ? event.data.method : undefined;
    const direction = method?.startsWith("ui/notifications/sandbox-") ? "sandbox -> host" : "view -> host";
    appendTraffic(direction, event.data);
  });
}

await connect();
if (getToolUiResourceUri(tools.find((tool) => tool.name === toolSelect.value) ?? {})) await callSelected();

function isRpc(data: unknown): data is RpcMessage {
  return !!data && typeof data === "object" && (data as { jsonrpc?: unknown }).jsonrpc === "2.0";
}

type RpcMessage = {
  method?: unknown;
  id?: unknown;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

function appendTraffic(direction: string, message: RpcMessage) {
  if (!logEnabled || !logEl) return;
  logEl.textContent += `${direction}  ${describeTraffic(message)}\n`;
}

function describeTraffic(message: RpcMessage): string {
  const method = typeof message.method === "string" ? message.method : undefined;
  const id = message.id === undefined || message.id === null ? undefined : String(message.id);
  if (method && id !== undefined) methodsById.set(id, method);
  if (method === "ui/notifications/sandbox-resource-ready") {
    const params = message.params;
    const html = params && typeof params === "object" && "html" in params ? params.html : undefined;
    const chars = typeof html === "string" ? html.length : 0;
    return `${method} (html ${chars} chars)`;
  }
  if (method) return method;
  if (id !== undefined && (message.result !== undefined || message.error !== undefined)) {
    const called = methodsById.get(id);
    return called ? `${called} result` : `result #${id}`;
  }
  return "message";
}
