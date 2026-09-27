# RimSort

A basic Tauri desktop UI for working with RimWorld mod lists.

The current UI can import a `ModsConfig.xml`, drag discovered mods between the
active and inactive lists, and export the active list as `ModsConfig.xml`.

Settings can detect and store Windows RimWorld, config, local mods, and Steam
Workshop paths. Autodetection checks the Windows Steam registry and Steam
libraries; non-Steam game scans cover standard install folders. Other platforms
can still edit paths manually, but autodetection is currently Windows-only.

At startup, the app reads active IDs from the configured `ModsConfig.xml` and
scans the configured game `Data`, local mods, and Steam Workshop folders for
`About/About.xml`. Discovered mods appear in the active or inactive list; rows
show the mod name, package ID, and source. Click a row for local details and,
when available, Steam Workshop title, description, preview image, and update
time.

## Run

- `deno task dev` starts the frontend in Vite.
- `deno task tauri dev` starts the Tauri desktop app.
- `deno task build` checks TypeScript and builds the frontend.
- `deno task tauri build` builds the desktop bundle.

Path detection and mod folder scans need the Tauri desktop runtime; the Vite
preview cannot access RimWorld files.
