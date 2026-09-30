# Fast rimworld manager

This is not ready AT ALL so please don't download this expecting it to work

## Startup mod-list classification

The app reads `ModsConfig.xml` from the configured RimWorld config folder.
Installed mods remain unclassified until the file is parsed; the `<activeMods>`
package IDs then determine which installed mods are inactive. Package ID
matching is case-insensitive and ignores the `_steam` suffix used for duplicate
Workshop entries.

Installed package IDs come from direct fields in `About.xml`; nested dependency
`packageId` entries are not used as a mod's identity.

## Storybook

Run `deno task storybook` to open Storybook at `http://localhost:6006`. Create a
static build with `deno task build-storybook`.
