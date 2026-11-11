/**
 * <talks-back> — a view that can start work, not only receive it.
 *
 * ontoolresult is the host pushing a result in.
 * callServerTool returns its result directly; it does not fire ontoolresult.
 * openLink asks the host to open a URL. Both are refused when the host
 * leaves that capability out of AppBridge.
 */
import { App } from "@modelcontextprotocol/ext-apps";

const SPEC_URL = "https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx";

type Data = { greeting: string; time: string };

class TalksBack extends HTMLElement {
  private data?: Data;
  private name = "";
  private note = "Waiting for the host…";
  private canCall = false;
  private canOpen = false;
  private app = new App({ name: "talks-back", version: "0.1.0" });

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.addEventListener("input", (event) => {
      if ((event.target as HTMLElement).id === "name") this.name = (event.target as HTMLInputElement).value;
    });
    root.addEventListener("click", (event) => {
      const id = (event.target as HTMLElement).id;
      if (id === "again") void this.greetAgain();
      if (id === "spec") void this.openSpec();
    });
    this.render();
  }

  connectedCallback() {
    // Register BEFORE connect() so a fast host cannot deliver the result first.
    this.app.ontoolresult = (result) => {
      this.data = result.structuredContent as Data;
      this.note = "From the host, via ontoolresult.";
      this.render();
    };
    void this.app.connect().then(() => {
      const caps = this.app.getHostCapabilities();
      this.canCall = Boolean(caps?.serverTools);
      this.canOpen = Boolean(caps?.openLinks);
      this.render();
    }).catch((err: unknown) => {
      this.note = err instanceof Error ? err.message : String(err);
      this.render();
    });
  }

  private async greetAgain() {
    if (!this.canCall) return;
    this.name = this.shadowRoot!.querySelector<HTMLInputElement>("#name")!.value;
    this.note = "Calling greet…";
    this.render();
    try {
      console.log("[view] callServerTool greet", { name: this.name });
      const result = await this.app.callServerTool({ name: "greet", arguments: { name: this.name } });
      if (result.isError || !result.structuredContent) throw new Error("The tool returned an error.");
      console.log("[view] callServerTool result", result.structuredContent);
      this.data = result.structuredContent as Data;
      this.note = "From callServerTool. ontoolresult did not run.";
    } catch (err) {
      this.note = err instanceof Error ? err.message : String(err);
    }
    this.render();
  }

  private async openSpec() {
    if (!this.canOpen) return;
    try {
      console.log("[view] openLink", SPEC_URL);
      const result = await this.app.openLink({ url: SPEC_URL });
      this.note = result.isError ? "The host refused to open the link." : "The host opened the spec.";
    } catch (err) {
      this.note = err instanceof Error ? err.message : String(err);
    }
    this.render();
  }

  private render() {
    const root = this.shadowRoot!;
    root.innerHTML = `
      <style>
        :host { display: block; font: 16px/1.5 system-ui; padding: 1rem; }
        time, .note { opacity: 0.65; }
        .row { display: flex; gap: 0.5rem; align-items: center; margin: 0.75rem 0; }
        input, button { font: inherit; }
        button:disabled { opacity: 0.45; }
      </style>
      <p id="greeting"></p>
      <time id="time"></time>
      <div class="row">
        <input id="name" type="text" placeholder="name" />
        <button id="again" type="button">Greet again</button>
        <button id="spec" type="button">Open the spec</button>
      </div>
      <p class="note" id="note"></p>
    `;
    const greeting = root.querySelector<HTMLElement>("#greeting")!;
    const time = root.querySelector<HTMLTimeElement>("#time")!;
    if (!this.data) {
      greeting.textContent = "Waiting for the tool result…";
      time.hidden = true;
    } else {
      greeting.textContent = this.data.greeting;
      time.hidden = false;
      time.dateTime = this.data.time;
      time.textContent = this.data.time;
    }
    root.querySelector<HTMLInputElement>("#name")!.value = this.name;
    root.querySelector<HTMLButtonElement>("#again")!.disabled = !this.canCall;
    root.querySelector<HTMLButtonElement>("#spec")!.disabled = !this.canOpen;
    root.querySelector("#note")!.textContent = this.note;
  }
}

customElements.define("talks-back", TalksBack);
