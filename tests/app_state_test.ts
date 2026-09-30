import { createStore } from 'jotai';
import {
	activeModsAtom,
	activeSearchAtom,
	configuredGameVersionAtom,
	gameVersionAtom,
	inactiveModsAtom,
	inactiveSearchAtom,
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

Deno.test('Jotai derives independent name-filtered mod lists with source indices', () => {
	const store = createStore();
	store.set(installedModsAtom, [
		installedMod('Core', 'Core'),
		installedMod('Author.Active', 'Search Target'),
		installedMod('Author.Inactive', 'Search Target Inactive'),
	]);
	store.set(activeModsAtom, ['Core', 'Author.Active']);
	store.set(inactiveModsAtom, ['Author.Inactive']);
	store.set(activeSearchAtom, 'search target');
	store.set(inactiveSearchAtom, 'inactive');

	const active = store.get(visibleActiveModsAtom);
	const inactive = store.get(visibleInactiveModsAtom);

	if (
		JSON.stringify(active) !==
			JSON.stringify([{ packageId: 'Author.Active', index: 1 }])
	) {
		throw new Error(
			`Unexpected active filter result: ${JSON.stringify(active)}`,
		);
	}
	if (
		JSON.stringify(inactive) !==
			JSON.stringify([{ packageId: 'Author.Inactive', index: 0 }])
	) {
		throw new Error(
			`Unexpected inactive filter result: ${JSON.stringify(inactive)}`,
		);
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
