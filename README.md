# RimSort

A basic Tauri desktop UI for working with RimWorld mod lists.

The interface uses shadcn/ui components with Tailwind CSS v4.

The current UI can import a `ModsConfig.xml`, drag discovered mods between the
active and inactive lists, and save the active list directly to the configured
RimWorld `ModsConfig.xml`.

Settings can detect and store Windows RimWorld, config, local mods, and Steam
Workshop paths. Autodetection checks the Windows Steam registry and Steam
libraries; non-Steam game scans cover standard install folders. Other platforms
can still edit paths manually, but autodetection is currently Windows-only.

Settings use native folder pickers for RimWorld paths. The import action opens a
native XML file picker and reads the selected mod list through the Tauri backend.

Settings can download RimSort's Community Rules and Steam Workshop databases to
the app configuration directory. The downloaded `communityRules.json` and
`steamDB.json` files are stored for metadata features.

Active mod rows highlight missing dependencies declared by `About.xml` or the
Steam Workshop database, and load-order violations from `About.xml` or Community
Rules. Selecting a highlighted mod shows the missing dependency names and the
required relative order. Updating either database refreshes the highlights.

The active-list checks report missing installed mods, duplicate active IDs,
unmet `About.xml` or SteamDB dependencies, and active `incompatibleWith` pairs
as errors. Community and About load-order violations and game-version mismatches
are warnings. A summary shows affected mod counts, rows show severity badges,
and each installed mod's details list the relevant package IDs.

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

Settings also accept a personal 32-character Steam Web API key, available at
`https://steamcommunity.com/dev/apikey`. The key is stored in Windows Credential
Manager and is not returned to the frontend after saving. Use **Test connection**
to verify access to an authenticated Steam API method. Workshop previews continue
to use their public endpoint and do not require this key.

**Check for updates** compares Steam's latest Workshop `time_updated` with the
installed timestamp in `appworkshop_294100.acf` and marks newer versions on their
mod rows. It does not download or modify mods. This public Workshop endpoint
does not require the saved API key.

## Run

- `deno task dev` runs Vite with its runner loader and ignores its temporary
  config bundle in Deno's file watcher.
- `deno task tauri dev` starts the Tauri desktop app.
- `deno task build` checks TypeScript and builds the frontend.
- `deno task tauri build` builds the desktop bundle.

Path detection and mod folder scans need the Tauri desktop runtime; the Vite
preview cannot access RimWorld files.
