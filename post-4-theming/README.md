# Post 4 — Theming and host context

Post 3's view can see the frame it is in. This view follows the host it is in: the light or dark theme, the CSS variables the host sends, and the rest of the host context. The tool result is only a timestamp. Locale and time zone decide how that timestamp is written.

## Run it

```bash
git clone https://github.com/mdownes/mcp-apps-series.git
cd mcp-apps-series/post-4-theming
npm install
npm start
```

Open **http://localhost:8080**. `npm start` builds this view and the shared host in [`../host`](../host), then starts the MCP server (http://localhost:3001/mcp) and the host. The host calls `context` on load. The sandboxed view shows the timestamp twice: once formatted, and once as the raw ISO string from `structuredContent`.

`?theme=dark` starts the host in dark theme. The checkbox on the page does the same thing after load.

## Things to try

1. **Read the initial context.** Theme is **light**, display is **inline**, locale is **en-US**, and the container is a max width and a max height. The note says the values came from `ui/initialize`. `onhostcontextchanged` has not run. `getHostContext()` is how the view reads this first copy, after `connect()`.
2. **Flip the theme.** Check **dark theme**. The background and the card switch to the dark side of the host's `light-dark()` colors. Only the Theme row is highlighted. The note says `theme → "dark"`. The host did not send the CSS variables again. `applyDocumentTheme` sets `color-scheme` on `<html>`, and that is what makes `light-dark()` pick the other side. "Resolved background" is the computed color, not the `light-dark()` string.
3. **Change the locale.** Set Locale to **fr-FR**, then **ja-JP**. The formatted line changes. The raw ISO line does not, and the tool is not called again. Only the Locale row is highlighted. Time zone stays on the host's zone (`Intl`'s resolved zone, often `UTC` here).
4. **Change the display mode.** Set Display to **fullscreen** or **pip**. The Display row updates, including the modes this host offers (`inline, fullscreen, pip`). This host only records the mode. It does not take over the screen or float the iframe. A view can also ask, with `requestDisplayMode`. The host may answer with a different mode than the one requested.
5. **Change the container.** **Narrow** fixes the iframe at 340×420 and the row reads `340px × 420px`. **Short** fixes the height at 240 and leaves the width flexible (`max 720px × 240px`). **Full** is `max 720px × max 420px`: the view may size itself up to that, rather than being pinned. This host's iframe is still a fixed box. It does not resize when the view sends `size-changed`.

The highlighted row is the field in that one notification. `getHostContext()` is the merge, so the other rows keep their values.

## What each file does

| File | Role |
|---|---|
| `server.ts` | The **MCP server**. One tool, `context`, and one `ui://` resource. The tool returns a timestamp. It does not know the theme. |
| `view.ts` | The **view**: a native custom element. `onhostcontextchanged` is registered before `connect()`. After connect it reads `getHostContext()`, applies the theme and the CSS variables, and renders the fields. |
| `view.html` | The page shell. The body uses the same CSS variables, with fallbacks for a host that sends none. Vite inlines it into `dist/view.html`. |

The host that draws the view lives in [`../host`](../host). The theme checkbox and the Display, Locale, and Container selects are in `index.html`. `host.ts` builds the context and sends changes with `setHostContext`.

## Worth knowing

- The notification is partial. Register the handler before `connect()`, then read the first copy with `getHostContext()`. The handler's argument is only what changed.
- `setHostContext` replaces the context the bridge has stored, and the notification contains the diff. Pass the whole context. The SDK example that passes `{ theme: "dark" }` drops every other stored field. `sendHostContextChange` does not update the stored copy, so the next `ui/initialize` would still see the old theme.
- A host may send any subset of the style variables, or none. Each `var()` in this view has a fallback. The fallbacks are neutral gray. This host sends a warm palette, so you can see which set is on the screen. The TypeScript type lists every key; on the wire they are optional. This host sends the handful the view uses.
- `styles.css.fonts` is a separate CSS string (`applyHostFonts`), not a variable. A font URL would also have to be listed in the resource's `resourceDomains`. This host does not send fonts. It also does not send `safeAreaInsets` or `deviceCapabilities`.
- `onhostcontextchanged` is the same property style as `ontoolresult` in the earlier posts. The SDK marks it deprecated in favor of `addEventListener("hostcontextchanged", …)`.

## Suggested reading order

1. `view.ts` — the initial context, the partial notification, and `light-dark()`
2. `view.html` — the fallback, for a host that sends no variables
3. `../host/host.ts` — the context object, and the controls that call `setHostContext`
4. `server.ts` — why the tool result is only a timestamp
