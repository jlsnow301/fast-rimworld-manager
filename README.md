# RimSort

A basic Tauri desktop UI for working with RimWorld mod lists.

The current UI can import a `ModsConfig.xml`, drag discovered mods between the
active and inactive lists, and save the active list directly to the configured
RimWorld `ModsConfig.xml`.

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

The Sort action topologically orders active mods using `About.xml` `loadAfter`
and `loadBefore` rules, placing core/framework tiers first and alphabetizing
otherwise independent mods. Circular rules report an error and leave the current
order unchanged.

The header shows **Unsaved changes** when the current game version, active mod
order, or known expansions differ from the last loaded or saved
`ModsConfig.xml`. Importing or editing marks the list dirty; restoring the saved
values or saving successfully clears the indicator.

## Run

- `deno task dev` starts the frontend in Vite.
- `deno task tauri dev` starts the Tauri desktop app.
- `deno task build` checks TypeScript and builds the frontend.
- `deno task tauri build` builds the desktop bundle.

Path detection and mod folder scans need the Tauri desktop runtime; the Vite
preview cannot access RimWorld files.
