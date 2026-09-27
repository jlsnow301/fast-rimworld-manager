# RimSort

A basic Tauri desktop UI for working with RimWorld mod lists.

The current UI can import a selected `ModsConfig.xml`, add package IDs, reorder active mods, move entries between active and inactive lists, and export a new `ModsConfig.xml`. It does not yet scan RimWorld folders or discover installed mods.

## Run

- `deno task dev` starts the frontend in Vite.
- `deno task tauri dev` starts the Tauri desktop app.
- `deno task build` checks TypeScript and builds the frontend.
- `deno task tauri build` builds the desktop bundle.
