# RimSort

A basic Tauri desktop UI for working with RimWorld mod lists.

The current UI can import a selected `ModsConfig.xml`, add package IDs, reorder
active mods, move entries between active and inactive lists, and export a new
`ModsConfig.xml`.

Settings can detect and store Windows RimWorld, config, local mods, and Steam
Workshop paths. Autodetection checks the Windows Steam registry and Steam
libraries; non-Steam game scans cover standard install folders. Other platforms
can still edit paths manually, but autodetection is currently Windows-only. The
app does not yet scan installed mods into the mod list.

## Run

- `deno task dev` starts the frontend in Vite.
- `deno task tauri dev` starts the Tauri desktop app.
- `deno task build` checks TypeScript and builds the frontend.
- `deno task tauri build` builds the desktop bundle.
