import { createStore } from 'jotai';
import {
	activeDimNonMatchingModsAtom,
	activeModsAtom,
	activeModSearchAtom,
	configuredGameVersionAtom,
	gameVersionAtom,
	inactiveDimNonMatchingModsAtom,
	inactiveModsAtom,
	inactiveModSearchAtom,
	installedGameVersionAtom,
	installedModsAtom,
	isModListDirtyAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
} from '@/features/mod-list/atoms.ts';
import type { InstalledMod } from '@/utils/types.ts';

function installedMod(packageId: string, name: string): InstalledMod {
	return {
		name,
		author: null,
		modVersion: null,
		packageId,
		description: '',
		publishedFileId: null,
		loadAfter: [],
		loadBefore: [],
		incompatibleWith: [],
		supportedVersions: [],
		versionWarningSilenced: false,
		path: '',
		source: 'local',
		dependencies: [],
	};
}

Deno.test('Jotai isolates active and inactive search and dim state', () => {
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
	store.set(activeModSearchAtom, 'search target');
	store.set(inactiveModSearchAtom, '');

	const active = store.get(visibleActiveModsAtom);
	const inactive = store.get(visibleInactiveModsAtom);
	const expectedActive = [
		{ packageId: 'Author.Active', index: 1, isMatch: true },
	];
	const expectedInactive = [
		{ packageId: 'Author.Inactive', index: 0, isMatch: true },
		{ packageId: 'Author.InactiveOther', index: 1, isMatch: true },
		{ packageId: 'Missing.Inactive', index: 2, isMatch: true },
	];
	if (
		JSON.stringify(active) !== JSON.stringify(expectedActive) ||
		JSON.stringify(inactive) !== JSON.stringify(expectedInactive)
	) {
		throw new Error(
			`Active search affected the inactive list: ${
				JSON.stringify({ active, inactive })
			}`,
		);
	}

	store.set(inactiveModSearchAtom, 'search target inactive');
	const independentlySearchedInactive = store.get(visibleInactiveModsAtom);
	if (
		JSON.stringify(store.get(visibleActiveModsAtom)) !==
			JSON.stringify(expectedActive) ||
		JSON.stringify(independentlySearchedInactive) !==
			JSON.stringify([
				{ packageId: 'Author.Inactive', index: 0, isMatch: true },
			])
	) {
		throw new Error('Each list must retain an independent search query.');
	}

	store.set(activeDimNonMatchingModsAtom, true);
	const dimmedActive = store.get(visibleActiveModsAtom);
	if (
		JSON.stringify(dimmedActive) !== JSON.stringify([
				{ packageId: 'Core', index: 0, isMatch: false },
				{ packageId: 'Author.Active', index: 1, isMatch: true },
				{ packageId: 'Author.ActiveOther', index: 2, isMatch: false },
			]) ||
		JSON.stringify(store.get(visibleInactiveModsAtom)) !==
			JSON.stringify([
				{ packageId: 'Author.Inactive', index: 0, isMatch: true },
			])
	) {
		throw new Error('Active dim mode must not affect inactive search.');
	}

	store.set(inactiveDimNonMatchingModsAtom, true);
	const dimmedInactive = store.get(visibleInactiveModsAtom);
	if (
		JSON.stringify(dimmedInactive) !== JSON.stringify([
			{ packageId: 'Author.Inactive', index: 0, isMatch: true },
			{ packageId: 'Author.InactiveOther', index: 1, isMatch: false },
		])
	) {
		throw new Error(
			`Dim mode must retain only known unmatched mods: ${
				JSON.stringify(dimmedInactive)
			}`,
		);
	}

	store.set(inactiveModSearchAtom, '');
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
