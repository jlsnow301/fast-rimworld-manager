# Fast rimworld manager

This is not ready AT ALL so please don't download this expecting it to work

The displayed game version is read from `Version.txt` in the configured RimWorld
folder. If it cannot be read, the app falls back to the version in
`ModsConfig.xml`, then to `1.4`.

Windows auto-detected folder paths are normalized to use consistent backslash
separators before they are shown or saved.

Installed Core and DLC entries from RimWorld's `Data` folder appear in the mod
lists with readable official names. Core cannot be deactivated; installed DLC
can be moved between Active and Inactive.

At desktop widths, the selected-mod preview is on the left and the Active and
Inactive mod lists are on the right. Narrow layouts stack the preview above the
lists.

Workshop update checks show progress while running, then report available
updates, no updates found, or when some installed Workshop mods could not be
compared.

The update dialog lists outdated Workshop mods with checkboxes. All are selected
by default, and only selected mods are sent to Steam.

The desktop window opens at 1200 × 800 and can be resized down to 720 × 600. The
interface reflows its columns and scales text with the window width.
