import { createStore } from 'jotai';
import {
	activeModsAtom,
	configuredGameVersionAtom,
	dimNonMatchingModsAtom,
	gameVersionAtom,
	inactiveModsAtom,
	installedGameVersionAtom,
	installedModsAtom,
	isModListDirtyAtom,
	modSearchAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
} from '@/features/mod-list/atoms.ts';
import type { InstalledMod } from '@/utils/types.ts';

function installedMod(packageId: string, name: string): InstalledMod {
	return {
		name,
		author: null,
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

Deno.test('Jotai applies shared search and dim state to both mod lists', () => {
	const store = createStore();
	store.set(installedModsAtom, [
		installedMod('Core', 'Core'),
		installedMod('Author.Active', 'Search Target'),
		installedMod('Author.ActiveOther', 'Unrelated active mod'),
		installedMod('Author.Inactive', 'Search Target Inactive'),
		installedMod('Author.InactiveOther', 'Unrelated inactive mod'),
	]);
	store.set(activeModsAtom, [
		'Core',
		'Author.Active',
		'Author.ActiveOther',
		'Missing.Active',
	]);
	store.set(inactiveModsAtom, [
		'Author.Inactive',
		'Author.InactiveOther',
		'Missing.Inactive',
	]);
	store.set(modSearchAtom, 'search target');

	const active = store.get(visibleActiveModsAtom);
	const inactive = store.get(visibleInactiveModsAtom);
	const expectedActive = [
		{ packageId: 'Author.Active', index: 1, isMatch: true },
	];
	const expectedInactive = [
		{ packageId: 'Author.Inactive', index: 0, isMatch: true },
	];
	if (
		JSON.stringify(active) !== JSON.stringify(expectedActive) ||
		JSON.stringify(inactive) !== JSON.stringify(expectedInactive)
	) {
		throw new Error(
			`Shared search produced ${JSON.stringify({ active, inactive })}`,
		);
	}

	store.set(dimNonMatchingModsAtom, true);
	const dimmedActive = store.get(visibleActiveModsAtom);
	const dimmedInactive = store.get(visibleInactiveModsAtom);
	const expectedDimmedActive = [
		{ packageId: 'Core', index: 0, isMatch: false },
		{ packageId: 'Author.Active', index: 1, isMatch: true },
		{ packageId: 'Author.ActiveOther', index: 2, isMatch: false },
	];
	const expectedDimmedInactive = [
		{ packageId: 'Author.Inactive', index: 0, isMatch: true },
		{ packageId: 'Author.InactiveOther', index: 1, isMatch: false },
	];
	if (
		JSON.stringify(dimmedActive) !== JSON.stringify(expectedDimmedActive) ||
		JSON.stringify(dimmedInactive) !==
			JSON.stringify(expectedDimmedInactive)
	) {
		throw new Error(
			`Dim mode produced ${
				JSON.stringify({
					dimmedActive,
					dimmedInactive,
				})
			}`,
		);
	}

	store.set(modSearchAtom, '');
	const restoredInactive = store.get(visibleInactiveModsAtom);
	if (
		restoredInactive[2]?.packageId !== 'Missing.Inactive' ||
		restoredInactive[2]?.index !== 2 ||
		restoredInactive[2]?.isMatch !== true
	) {
		throw new Error('Clearing search should restore missing IDs in order.');
	}
});

Deno.test('Jotai tracks mod-list dirty state through source atom transitions', () => {
	const store = createStore();
	store.set(activeModsAtom, ['Core']);

	if (!store.get(isModListDirtyAtom)) {
		throw new Error('Changing active mods should mark the list dirty.');
	}

	store.set(activeModsAtom, []);

	if (store.get(isModListDirtyAtom)) {
		throw new Error(
			'Restoring the saved mod list should clear dirty state.',
		);
	}
});

Deno.test('installed game version takes precedence over ModsConfig version', () => {
	const store = createStore();
	store.set(configuredGameVersionAtom, '1.5');
	store.set(installedGameVersionAtom, '1.6.4871 rev573');

	if (store.get(gameVersionAtom) !== '1.6.4871 rev573') {
		throw new Error('The installed game version should take precedence.');
	}
});

Deno.test('ModsConfig version is used when the installed game version is unknown', () => {
	const store = createStore();
	store.set(configuredGameVersionAtom, '1.5');

	if (store.get(gameVersionAtom) !== '1.5') {
		throw new Error('The configured version should be used as a fallback.');
	}
});
