// Two static servers on two origins (the host page and the sandbox must differ).
//
// Slimmed down from the official ext-apps basic-host (MIT OR Apache-2.0):
// https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host
import express from "express";
import { fileURLToPath } from "node:url";

const HOST_PORT = Number(process.env.HOST_PORT ?? 8080);
const SANDBOX_PORT = HOST_PORT + 1; // host.ts assumes "host port + 1"
const listen = (name: string, url: string) => (err?: Error) => {
  if (err) {
    console.error(`${name} failed:`, err.message);
    process.exit(1);
  }
  console.log(`${name}: ${url}`);
};

// fileURLToPath (not URL.pathname) so Windows drive letters and spaces in folder names work.
const dir = fileURLToPath(new URL("./dist", import.meta.url));

const host = express();
host.use(express.static(dir));
host.listen(HOST_PORT, listen("Open", `http://localhost:${HOST_PORT}`));

// Same CSP builder idea as basic-host/serve.ts, trimmed. Domains come from the resource's _meta.ui.csp.
const clean = (domains: unknown) =>
  (Array.isArray(domains) ? domains.filter((item) => typeof item === "string" && !/[;\r\n'" ]/.test(item)) : []).join(" ");

const sandbox = express();
sandbox.get("/sandbox.html", (req, res) => {
  let csp: { resourceDomains?: unknown; connectDomains?: unknown } = {};
  try {
    csp = JSON.parse(String(req.query.csp ?? "{}"));
  } catch {
    // A bad query falls back to an empty policy.
  }
  const resources = clean(csp.resourceDomains);
  const connect = clean(csp.connectDomains);
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline' ${resources}`,
      `style-src 'self' 'unsafe-inline' ${resources}`,
      `img-src 'self' data: ${resources}`,
      `connect-src 'self' ${connect}`,
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
    ].join("; "),
  );
  res.sendFile("sandbox.html", { root: dir });
});
sandbox.use(express.static(dir));
sandbox.listen(SANDBOX_PORT, listen("Sandbox proxy", `http://localhost:${SANDBOX_PORT}/sandbox.html`));
