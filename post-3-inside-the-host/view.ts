/**
 * <inside-host> — the inner iframe of the host's sandbox.
 *
 * Host page (port 8080) -> sandbox proxy (port 8081) -> this document.
 * The proxy writes this file into a second iframe and relays postMessage.
 * allow-popups and allow-top-navigation are not set. The host page is a
 * different origin, so this document cannot read it.
 *
 * Fetch is gated by the CSP header on the sandbox proxy. That header is
 * built from the resource's _meta.ui.csp. The tool result tells us which
 * URL was declared and which URL was left out.
 */
import { App } from "@modelcontextprotocol/ext-apps";

type Data = {
  allowedUrl: string;
  blockedUrl: string;
  connectDomains: string[];
  resourceDomains: string[];
};

class InsideHost extends HTMLElement {
  private data?: Data;
  private origin = "…";
  private url = "…";
  private parentIsTop = "…";
  private proxyOrigin = "…";
  private sandboxAttr = "…";
  private connectSrc = "Reading the CSP header…";
  private imgSrc = "…";
  private openResult = "Checking…";
  private navResult = "Checking…";
  private readResult = "Checking…";
  private allowedResult = "Waiting for the tool result…";
  private blockedResult = "Waiting for the tool result…";
  private toolNote = "Waiting for the tool result…";
  private fetchGen = 0;
  private app = new App({ name: "inside-the-host", version: "0.1.0" });

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.addEventListener("click", (event) => {
      const id = (event.target as HTMLElement).id;
      if (id === "open" || id === "navigate" || id === "read") this.runSandbox();
      if (id === "allowed" || id === "blocked") void this.runFetches();
    });
    this.render();
  }

  connectedCallback() {
    this.readFrame();
    this.runSandbox();
    void this.readCspHeader();
    // Register BEFORE connect() so a fast host cannot deliver the result first.
    this.app.ontoolresult = (result) => {
      const data = result.structuredContent;
      if (!isData(data)) {
        this.toolNote = "The tool result had no CSP urls.";
        this.render();
        return;
      }
      this.data = data;
      this.toolNote = "Tool result received, via ontoolresult.";
      this.render();
      void this.runFetches();
    };
    void this.app.connect().catch((err: unknown) => {
      this.toolNote = err instanceof Error ? err.message : String(err);
      this.render();
    });
  }

  private readFrame() {
    this.origin = window.origin;
    // document.write keeps the writer's URL, so this is the proxy's path.
    this.url = window.location.pathname;
    this.parentIsTop = window.parent === window.top ? "yes" : "no";
    this.sandboxAttr = window.frameElement?.getAttribute("sandbox") ?? "(no frame element)";
    try {
      // The sandbox proxy is the parent, and it is the same origin as this view.
      this.proxyOrigin = window.parent.location.origin;
    } catch (err) {
      this.proxyOrigin = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
  }

  private runSandbox() {
    this.openResult = tryOpen();
    this.navResult = tryNavigate();
    this.readResult = tryReadHost();
    this.render();
  }

  private async readCspHeader() {
    try {
      // Same origin as the proxy, so we can fetch sandbox.html and read the
      // header serve.ts set from _meta.ui.csp.
      const response = await fetch(window.parent.location.href);
      const header = response.headers.get("content-security-policy") ?? "";
      this.connectSrc = directive(header, "connect-src");
      this.imgSrc = directive(header, "img-src");
    } catch (err) {
      this.connectSrc = err instanceof Error ? err.message : String(err);
      this.imgSrc = "…";
    }
    this.render();
  }

  private async runFetches() {
    if (!this.data) return;
    const gen = ++this.fetchGen;
    const allowedUrl = this.data.allowedUrl;
    const blockedUrl = this.data.blockedUrl;
    this.allowedResult = "Fetching…";
    this.blockedResult = "Fetching…";
    this.render();
    const [allowed, blocked] = await Promise.all([
      probeFetch(allowedUrl),
      probeFetch(blockedUrl),
    ]);
    if (gen !== this.fetchGen) return;
    this.allowedResult = allowed;
    this.blockedResult = blocked;
    this.render();
  }

  private render() {
    const root = this.shadowRoot!;
    root.innerHTML = `
      <style>
        :host { display: block; font: 13px/1.4 system-ui; padding: 0.6rem 0.85rem; }
        h2 { font: 600 11px/1.2 system-ui; letter-spacing: 0.04em; text-transform: uppercase; margin: 0 0 0.3rem; opacity: 0.6; }
        p { margin: 0.12rem 0; }
        code { font-family: ui-monospace, monospace; font-size: 12px; overflow-wrap: anywhere; }
        .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 1rem; }
        .cols > * { min-width: 0; }
        .block { margin-top: 0.55rem; }
        .row { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.3rem 0; }
        button { font: inherit; }
        .hint { opacity: 0.65; }
      </style>
      <div class="cols">
        <section>
          <h2>This frame</h2>
          <p>Origin <code id="origin"></code></p>
          <p>Path <code id="url"></code></p>
          <p>Parent is the top window: <span id="parent-top"></span></p>
          <p>Sandbox proxy <code id="proxy"></code></p>
          <p>sandbox="<code id="sandbox-attr"></code>"</p>
        </section>
        <section>
          <h2>CSP header</h2>
          <p><code id="connect-src"></code></p>
          <p><code id="img-src"></code></p>
          <p id="declared"></p>
        </section>
      </div>
      <section class="block">
        <h2>What the sandbox blocks</h2>
        <div class="row">
          <button id="open" type="button">Open a tab</button>
          <button id="navigate" type="button">Navigate the host</button>
          <button id="read" type="button">Read the host page</button>
        </div>
        <p id="open-result"></p>
        <p id="nav-result"></p>
        <p id="read-result"></p>
      </section>
      <section class="block">
        <h2>What the CSP header blocks</h2>
        <div class="row">
          <button id="allowed" type="button">Fetch localhost:3001</button>
          <button id="blocked" type="button">Fetch 127.0.0.1:3001</button>
        </div>
        <p id="allowed-result"></p>
        <p id="blocked-result"></p>
      </section>
      <p class="block" id="tool"></p>
      <p class="hint">AppBridge traffic is on the host page. Reload with ?log=1.</p>
    `;
    text(root, "#origin", this.origin);
    text(root, "#url", this.url);
    text(root, "#parent-top", this.parentIsTop);
    text(root, "#proxy", this.proxyOrigin);
    text(root, "#sandbox-attr", this.sandboxAttr);
    text(root, "#connect-src", this.connectSrc);
    text(root, "#img-src", this.imgSrc);
    text(root, "#declared", declared(this.data));
    text(root, "#open-result", this.openResult);
    text(root, "#nav-result", this.navResult);
    text(root, "#read-result", this.readResult);
    text(root, "#allowed-result", this.allowedResult);
    text(root, "#blocked-result", this.blockedResult);
    text(root, "#tool", this.toolNote);
  }
}

function text(root: ShadowRoot, selector: string, value: string) {
  root.querySelector(selector)!.textContent = value;
}

function declared(data: Data | undefined): string {
  if (!data) return "Waiting for the tool result…";
  const connect = data.connectDomains.join(", ") || "(none)";
  const resources = data.resourceDomains.join(", ") || "(none)";
  return `Declared connectDomains: ${connect}. resourceDomains: ${resources}.`;
}

function isData(value: unknown): value is Data {
  if (!value || typeof value !== "object") return false;
  const data = value as Data;
  return typeof data.allowedUrl === "string"
    && typeof data.blockedUrl === "string"
    && Array.isArray(data.connectDomains)
    && Array.isArray(data.resourceDomains);
}

function directive(header: string, name: string): string {
  const found = header.split(";").map((part) => part.trim()).find((part) => part === name || part.startsWith(`${name} `));
  return found ?? `(no ${name})`;
}

function tryOpen(): string {
  const popup = window.open("https://example.org/", "_blank", "noopener,noreferrer");
  if (popup) {
    popup.close();
    return "Not blocked. window.open returned a window.";
  }
  return "Blocked. window.open returned null (no allow-popups).";
}

function tryNavigate(): string {
  try {
    window.top!.location.assign("https://example.org/mcp-apps-sandbox-test");
    return "Not blocked. The view set window.top.location.";
  } catch (err) {
    return expectSecurityError(err, "No allow-top-navigation, so the view cannot navigate the host.");
  }
}

function tryReadHost(): string {
  try {
    const title = window.top!.document.title;
    return `Not blocked. Host title is "${title}".`;
  } catch (err) {
    return expectSecurityError(err, "The host page is a different origin, so the view cannot read it.");
  }
}

function expectSecurityError(err: unknown, why: string): string {
  const name = err instanceof Error ? err.name : "Error";
  if (name === "SecurityError") return `Blocked (SecurityError). ${why}`;
  const message = err instanceof Error ? err.message : String(err);
  return `Unexpected ${name}: ${message}`;
}

async function probeFetch(url: string): Promise<string> {
  let onViolation: ((event: SecurityPolicyViolationEvent) => void) | undefined;
  const cleanup = () => {
    if (!onViolation) return;
    document.removeEventListener("securitypolicyviolation", onViolation);
    onViolation = undefined;
  };
  const violation = new Promise<SecurityPolicyViolationEvent>((resolve) => {
    onViolation = (event) => {
      const blocked = event.blockedURI.replace(/\/$/, "");
      const target = url.replace(/\/$/, "");
      if (blocked !== target && !target.startsWith(blocked)) return;
      cleanup();
      resolve(event);
    };
    document.addEventListener("securitypolicyviolation", onViolation);
  });
  try {
    const response = await fetch(url);
    const body = await response.text();
    cleanup();
    return `Allowed. ${body}`;
  } catch (err) {
    const event = await Promise.race([
      violation,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 300)),
    ]);
    cleanup();
    if (event) return `Blocked (${event.effectiveDirective}). ${event.blockedURI}`;
    const message = err instanceof Error ? err.message : String(err);
    return `Failed. ${message}`;
  }
}

customElements.define("inside-host", InsideHost);
