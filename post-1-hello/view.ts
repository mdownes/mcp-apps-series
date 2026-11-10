/**
 * <hello-view> — the view. It runs in the host's sandboxed iframe
 * and never talks to the MCP server itself. The host pushes the
 * tool result in; ontoolresult stores it and Lit re-renders.
 */
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { App } from "@modelcontextprotocol/ext-apps";

type Data = { greeting: string; time: string };

@customElement("hello-view")
export class HelloView extends LitElement {
  @state() data?: Data;
  private app = new App({ name: "hello-view", version: "0.1.0" });

  static styles = css`
    :host { display: block; font: 16px/1.5 system-ui; padding: 1rem; }
    time { opacity: 0.65; }
  `;

  connectedCallback() {
    super.connectedCallback();
    // Register BEFORE connect() so a fast host cannot deliver the result first.
    this.app.ontoolresult = (r) => (this.data = r.structuredContent as Data);
    this.app.connect();
  }

  render() {
    if (!this.data) return html`<p>Waiting for the tool result…</p>`;
    return html`
      <p>${this.data.greeting}</p>
      <time datetime=${this.data.time}>${this.data.time}</time>
    `;
  }
}
