import { createStore } from 'jotai';
import {
	activeModsAtom,
	activeSearchAtom,
	inactiveModsAtom,
	inactiveSearchAtom,
	installedModsAtom,
	isModListDirtyAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
} from './src/state/app-atoms.ts';
import type { InstalledMod } from './src/utils/types.ts';

function installedMod(packageId: string, name: string): InstalledMod {
	return {
		name,
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
		throw new Error('Restoring the saved mod list should clear dirty state.');
	}
});
