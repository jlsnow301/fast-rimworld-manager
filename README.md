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
