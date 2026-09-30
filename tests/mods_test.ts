import { getInactivePackageIds } from '@/utils/mods.ts';
import type { InstalledMod } from '@/utils/types.ts';

function installedMod(packageId: string): InstalledMod {
	return {
		name: packageId,
		packageId,
		description: '',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: [],
		path: '',
		source: 'local',
		dependencies: [],
	};
}

Deno.test('package IDs in ModsConfig are matched case-insensitively and with Steam suffixes', () => {
	const inactive = getInactivePackageIds(
		[
			installedMod('ludeon.rimworld'),
			installedMod('author.active_steam'),
			installedMod('author.inactive'),
		],
		['Ludeon.RimWorld', 'Author.Active'],
	);

	if (JSON.stringify(inactive) !== JSON.stringify(['author.inactive'])) {
		throw new Error(
			`Expected only truly inactive mods, got ${
				JSON.stringify(inactive)
			}.`,
		);
	}
});

Deno.test('mods are not classified as inactive before a mod list is loaded', () => {
	const inactive = getInactivePackageIds(
		[installedMod('ludeon.rimworld'), installedMod('author.mod')],
		null,
	);

	if (inactive.length !== 0) {
		throw new Error(
			`Unknown mod state must not be classified as inactive: ${
				JSON.stringify(inactive)
			}.`,
		);
	}
});
