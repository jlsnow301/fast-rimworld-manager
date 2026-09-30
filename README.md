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

During startup, mod panels keep their final height and show Skeleton
placeholders until loading completes. A failed load, a loaded list, and a
successful load with no mod list have distinct status messages.
