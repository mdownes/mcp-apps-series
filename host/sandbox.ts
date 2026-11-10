// Sandbox proxy: a different origin from the host. It creates the inner iframe,
// writes the view HTML into it, then relays postMessage both ways:
//   Host (8080)  <->  this proxy (8081)  <->  view (inner iframe)
//
// Slimmed down from the official ext-apps basic-host (MIT OR Apache-2.0):
// https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host
const HOST_ORIGIN = new URL(document.referrer).origin;
const inner = document.createElement("iframe");
inner.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
document.body.appendChild(inner);

window.addEventListener("message", (event) => {
  if (event.source === window.parent && event.origin === HOST_ORIGIN) {
    if (event.data?.method === "ui/notifications/sandbox-resource-ready") {
      const doc = inner.contentDocument!; // inherits this page's CSP
      doc.open();
      doc.write(event.data.params.html);
      doc.close();
    } else {
      inner.contentWindow?.postMessage(event.data, "*");
    }
  } else if (event.source === inner.contentWindow) {
    window.parent.postMessage(event.data, HOST_ORIGIN);
  }
});

window.parent.postMessage(
  { jsonrpc: "2.0", method: "ui/notifications/sandbox-proxy-ready", params: {} },
  HOST_ORIGIN,
);
