// The host (stand-in for Claude or ChatGPT): an MCP client, a tool picker, and an AppBridge to the iframe.
//
// Slimmed down from the official ext-apps basic-host (MIT OR Apache-2.0):
// https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host
import {
  AppBridge,
  PostMessageTransport,
  getToolUiResourceUri,
  type McpUiDisplayMode,
  type McpUiHostContext,
  type McpUiStyles,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client, StreamableHTTPClientTransport, type CallToolResult, type JSONRPCMessage, type Tool, type TransportSendOptions } from "@modelcontextprotocol/client";

const DEFAULT_MCP_URL = "http://localhost:3001/mcp";

const mcpInput = document.querySelector<HTMLInputElement>("#mcp")!;
const toolSelect = document.querySelector<HTMLSelectElement>("#tool")!;
const argsInput = document.querySelector<HTMLInputElement>("#args")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const iframe = document.querySelector<HTMLIFrameElement>("#app")!;
const dark = document.querySelector<HTMLInputElement>("#dark")!;
const displaySelect = document.querySelector<HTMLSelectElement>("#display")!;
const localeSelect = document.querySelector<HTMLSelectElement>("#locale")!;
const containerSelect = document.querySelector<HTMLSelectElement>("#container")!;
const theme = (): "dark" | "light" => (dark.checked ? "dark" : "light");

const query = new URLSearchParams(location.search);
mcpInput.value = query.get("server") || DEFAULT_MCP_URL;
if (query.get("theme") === "dark") dark.checked = true;

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
// Post 4. Posts 1–3 never read the notification these send.
dark.addEventListener("change", publishContext);
displaySelect.addEventListener("change", publishContext);
localeSelect.addEventListener("change", publishContext);
containerSelect.addEventListener("change", () => {
  applyContainerFrame();
  publishContext();
});

function showError(err: unknown) {
  statusEl.textContent = err instanceof Error ? err.message : String(err);
  console.error(err);
}

// The spec type lists every variable. A host may send any subset.
// Colors use light-dark(), so a theme change does not send them again.
// The view's own fallbacks are neutral gray; these are warm, so you can see which set is on screen.
const HOST_STYLE_VARIABLES = {
  "--color-background-primary": "light-dark(#f4efe4, #1c1915)",
  "--color-background-secondary": "light-dark(#fffdf8, #2a241c)",
  "--color-background-info": "light-dark(#efe2c9, #3d3426)",
  "--color-text-primary": "light-dark(#3f2e1e, #f6efe4)",
  "--color-text-secondary": "light-dark(#7a6552, #cbbba6)",
  "--color-border-primary": "light-dark(#e0d3c2, #4a3f32)",
  "--font-sans": "system-ui, sans-serif",
  "--font-mono": "ui-monospace, monospace",
  "--border-radius-md": "8px",
  "--border-radius-lg": "12px",
} as McpUiStyles;

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function displayMode(): McpUiDisplayMode {
  const value = displaySelect.value;
  if (value === "fullscreen" || value === "pip") return value;
  return "inline";
}

function containerDimensions(): McpUiHostContext["containerDimensions"] {
  // full is flexible on both axes. narrow is fixed. short fixes the height only.
  // The numbers stay stable so a theme toggle does not also look like a resize.
  if (containerSelect.value === "narrow") return { width: 340, height: 420 };
  if (containerSelect.value === "short") return { maxWidth: 720, height: 240 };
  return { maxWidth: 720, maxHeight: 420 };
}

function applyContainerFrame() {
  if (containerSelect.value === "narrow") {
    iframe.style.width = "340px";
    iframe.style.height = "420px";
    return;
  }
  if (containerSelect.value === "short") {
    iframe.style.width = "";
    iframe.style.height = "240px";
    return;
  }
  iframe.style.width = "";
  iframe.style.height = "";
}

function hostContext(): McpUiHostContext {
  return {
    theme: theme(),
    platform: "web",
    displayMode: displayMode(),
    availableDisplayModes: ["inline", "fullscreen", "pip"],
    locale: localeSelect.value,
    timeZone,
    containerDimensions: containerDimensions(),
    styles: { variables: HOST_STYLE_VARIABLES },
  };
}

function publishContext() {
  // Pass the whole context. setHostContext replaces the stored copy and
  // notifies the view with only the fields that differ. A patch such as
  // { theme: "dark" } would drop styles, locale, and the rest.
  bridge?.setHostContext(hostContext());
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
    { hostContext: hostContext() },
  );
  if (hostCapabilities.openLinks) {
    bridge.onopenlink = async ({ url }) => {
      console.log("[host] openLink", url);
      window.open(url, "_blank", "noopener");
      return {};
    };
  }
  bridge.onmessage = async (params) => (console.log("[host] ui/message", params), {});
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
