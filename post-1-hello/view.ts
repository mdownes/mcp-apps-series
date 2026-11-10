/**
 * <hello-view> — the view. It runs in the host's sandboxed iframe
 * and never talks to the MCP server itself. The host pushes the
 * tool result in; ontoolresult stores it and the element re-renders.
 */
import { App } from "@modelcontextprotocol/ext-apps";

type Data = { greeting: string; time: string };

class HelloView extends HTMLElement {
  private data?: Data;
  private app = new App({ name: "hello-view", version: "0.1.0" });

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.render();
  }

  connectedCallback() {
    // Register BEFORE connect() so a fast host cannot deliver the result first.
    this.app.ontoolresult = (result) => {
      this.data = result.structuredContent as Data;
      this.render();
    };
    this.app.connect();
  }

  private render() {
    const root = this.shadowRoot!;
    root.innerHTML = `
      <style>
        :host { display: block; font: 16px/1.5 system-ui; padding: 1rem; }
        time { opacity: 0.65; }
      </style>
    `;
    const message = document.createElement("p");
    if (!this.data) {
      message.textContent = "Waiting for the tool result…";
      root.append(message);
      return;
    }
    message.textContent = this.data.greeting;
    const time = document.createElement("time");
    time.dateTime = this.data.time;
    time.textContent = this.data.time;
    root.append(message, time);
  }
}

customElements.define("hello-view", HelloView);
