/**
 * <host-context> — follows the host's theme and the rest of its context.
 *
 * The first copy arrives on ui/initialize. Read it with getHostContext()
 * after connect(). Later edits arrive as ui/notifications/host-context-changed.
 * That notification is partial: only the fields that changed. The SDK merges
 * them into getHostContext() before this handler runs.
 *
 * Colors come in as CSS variables, usually written with light-dark().
 * applyDocumentTheme sets color-scheme, which is what makes light-dark()
 * pick a side. applyHostStyleVariables copies the variables onto <html>,
 * and they inherit into this shadow tree. A host may send none of them,
 * so every var() has a fallback.
 */
import { App, applyDocumentTheme, applyHostStyleVariables, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";

type Data = { sample: string };

const FIELDS = [
  ["theme", "Theme"],
  ["displayMode", "Display"],
  ["locale", "Locale"],
  ["timeZone", "Time zone"],
  ["platform", "Platform"],
  ["containerDimensions", "Container"],
  ["styles", "Styles"],
] as const;

class HostContextView extends HTMLElement {
  private data?: Data;
  private context?: McpUiHostContext;
  private changed = new Set<string>();
  private notice = "Waiting for the host…";
  private seenChange = false;
  private app = new App(
    { name: "host-context", version: "0.1.0" },
    // The spec asks the view to list the display modes it can live with.
    { availableDisplayModes: ["inline", "fullscreen", "pip"] },
  );

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
  }

  connectedCallback() {
    // Register BEFORE connect(), same reason as ontoolresult: a fast host
    // must not be able to deliver the notification first.
    this.app.ontoolresult = (result) => {
      const data = result.structuredContent;
      if (data && typeof data === "object" && typeof (data as Data).sample === "string") {
        this.data = data as Data;
      }
      this.render();
    };
    this.app.onhostcontextchanged = (partial) => {
      this.seenChange = true;
      this.changed = new Set(Object.keys(partial));
      this.notice = describeChange(partial);
      // Partial: theme may arrive without styles. Leave the old variables in place.
      applyLook(partial);
      this.context = this.app.getHostContext();
      this.render();
    };
    void this.app.connect().then(() => {
      this.context = this.app.getHostContext();
      if (this.context) applyLook(this.context);
      if (!this.seenChange) {
        this.notice = "These values came from ui/initialize. No host-context-changed notification yet.";
      }
      this.render();
    }).catch((err: unknown) => {
      this.notice = err instanceof Error ? err.message : String(err);
      this.render();
    });
  }

  private render() {
    const root = this.shadowRoot!;
    const rows = FIELDS.map(([key, label]) => `
      <div class="field" data-key="${key}">
        <span class="k">${label}</span>
        <span id="${key}"></span>
      </div>
    `).join("");
    root.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          min-height: 100%;
          padding: 0.75rem 0.9rem;
          font: 14px/1.4 var(--font-sans, system-ui, sans-serif);
          background: var(--color-background-primary, light-dark(#ffffff, #1a1a1a));
          color: var(--color-text-primary, light-dark(#18181b, #fafafa));
        }
        .kicker {
          margin: 0 0 0.3rem;
          font: 600 11px/1.2 var(--font-sans, system-ui, sans-serif);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-text-secondary, light-dark(#52525b, #a1a1aa));
        }
        .layout {
          display: grid;
          grid-template-columns: minmax(22rem, 1.15fr) minmax(0, 1fr);
          gap: 0.65rem 1rem;
          align-items: start;
        }
        @media (max-width: 520px) {
          .layout { grid-template-columns: 1fr; }
        }
        .card {
          background: var(--color-background-secondary, light-dark(#f4f4f5, #27272a));
          border: 1px solid var(--color-border-primary, light-dark(#e4e4e7, #3f3f46));
          border-radius: var(--border-radius-lg, 12px);
          padding: 0.65rem 0.75rem;
        }
        #sample { margin: 0; font-weight: 600; }
        .muted { margin: 0.35rem 0 0; color: var(--color-text-secondary, light-dark(#52525b, #a1a1aa)); }
        .raw { margin: 0.2rem 0 0; font: 12px/1.4 var(--font-mono, ui-monospace, monospace); }
        .field {
          display: grid;
          grid-template-columns: 6.6rem minmax(0, 1fr);
          gap: 0.35rem;
          padding: 0.12rem 0.35rem;
          border-radius: var(--border-radius-md, 6px);
        }
        .field .k { color: var(--color-text-secondary, light-dark(#52525b, #a1a1aa)); }
        .field > span:last-child { white-space: pre-line; }
        .field.changed { background: var(--color-background-info, light-dark(#eff6ff, #1e3a5f)); }
        .note { margin: 0.7rem 0 0; }
        code { font-family: var(--font-mono, ui-monospace, monospace); font-size: 12px; }
      </style>
      <div class="layout">
        <section class="card">
          <p class="kicker">CSS variables</p>
          <p id="sample"></p>
          <p class="muted raw" id="raw"></p>
          <p class="muted" id="resolved"></p>
        </section>
        <section>
          <p class="kicker">Host context</p>
          ${rows}
        </section>
      </div>
      <p class="note" id="notice"></p>
    `;
    const ctx = this.context;
    text(root, "#sample", formatSample(this.data?.sample, ctx));
    text(root, "#raw", this.data ? this.data.sample : "Waiting for the tool result…");
    text(root, "#resolved", `Resolved background ${getComputedStyle(this).backgroundColor}.`);
    text(root, "#theme", ctx?.theme ?? "not sent");
    text(root, "#displayMode", formatDisplay(ctx));
    text(root, "#locale", ctx?.locale ?? "not sent");
    text(root, "#timeZone", ctx?.timeZone ?? "not sent");
    text(root, "#platform", ctx?.platform ?? "not sent");
    text(root, "#containerDimensions", formatDimensions(ctx?.containerDimensions));
    text(root, "#styles", formatStyles(ctx));
    text(root, "#notice", this.notice);
    for (const [key] of FIELDS) {
      root.querySelector(`[data-key="${key}"]`)?.classList.toggle("changed", this.changed.has(key));
    }
  }
}

// Theme sets color-scheme. Variables are copied once; a later theme
// notification does not repeat them, and light-dark() still flips.
function applyLook(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
}

function text(root: ShadowRoot, selector: string, value: string) {
  root.querySelector(selector)!.textContent = value;
}

function formatSample(iso: string | undefined, ctx: McpUiHostContext | undefined): string {
  if (!iso) return "Waiting for the tool result…";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(ctx?.locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: ctx?.timeZone,
    }).format(date);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function formatDisplay(ctx: McpUiHostContext | undefined): string {
  if (!ctx?.displayMode) return "not sent";
  const offers = ctx.availableDisplayModes?.join(", ");
  return offers ? `${ctx.displayMode}\noffers ${offers}` : ctx.displayMode;
}

function formatDimensions(value: McpUiHostContext["containerDimensions"]): string {
  if (!value) return "not sent";
  // Fixed (width/height) wins over flexible (maxWidth/maxHeight) when both are present.
  const width = pixels(value, "width") ?? prefix("max ", pixels(value, "maxWidth"));
  const height = pixels(value, "height") ?? prefix("max ", pixels(value, "maxHeight"));
  return `${width ?? "unbounded"} × ${height ?? "unbounded"}`;
}

function pixels(value: object, key: string): string | undefined {
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" ? `${raw}px` : undefined;
}

function prefix(label: string, value: string | undefined): string | undefined {
  return value ? `${label}${value}` : undefined;
}

function formatStyles(ctx: McpUiHostContext | undefined): string {
  const variables = ctx?.styles?.variables;
  if (!variables) return "not sent";
  const count = Object.values(variables).filter((item) => typeof item === "string").length;
  return count ? `${count} variables, light-dark()` : "not sent";
}

function describeChange(partial: McpUiHostContext): string {
  const parts = Object.entries(partial)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => key === "styles" ? "styles" : `${key} → ${JSON.stringify(value)}`);
  if (!parts.length) return "The host sent an empty change.";
  return `Changed ${parts.join(", ")}. Other fields stayed as they were.`;
}

customElements.define("host-context", HostContextView);
