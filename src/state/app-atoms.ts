import { atom } from 'jotai';
import { createModListSnapshot, hasModListChanges } from '../utils/dirty_state';
import { createActiveModDiagnostics } from '../utils/mod_highlights';
import { filterVisibleMods } from '../utils/mod_search';
import { EMPTY_PATH_SETTINGS, normalizedPackageId } from '../utils/mods';
import type { ModListSnapshot } from '../utils/dirty_state';
import type {
	DatabaseKind,
	InstalledMod,
	PathSettings,
	SteamModPreview,
} from '../utils/types';

export const settingsOpenAtom = atom(false);
export const pathSettingsAtom = atom<PathSettings>(EMPTY_PATH_SETTINGS);
export const settingsMessageAtom = atom('Loading saved paths.');
export const databaseMessageAtom = atom(
	'Databases are saved in the app data folder.',
);
export const downloadingDatabaseAtom = atom<DatabaseKind | null>(null);
export const statusAtom = atom(
	'Waiting for configured mods. Set the RimWorld paths in Settings.',
);
export const selectedModAtom = atom<InstalledMod | null>(null);
export const previewMessageAtom = atom('');
export const steamPreviewAtom = atom<SteamModPreview | null>(null);
export const closeModPreviewAtom = atom(null, (_get, set) => {
	set(selectedModAtom, null);
	set(steamPreviewAtom, null);
	set(previewMessageAtom, '');
});

export const installedModsAtom = atom<InstalledMod[]>([]);
export const activeModsAtom = atom<string[]>([]);
export const inactiveModsAtom = atom<string[]>([]);
export const knownExpansionsAtom = atom<string[]>([]);
export const gameVersionAtom = atom('1.4');
export const sourceNameAtom = atom('');
export const activeSearchAtom = atom('');
export const inactiveSearchAtom = atom('');
export const savedSnapshotAtom = atom<ModListSnapshot>(
	createModListSnapshot('1.4', [], []),
);

export const modDetailsByPackageIdAtom = atom((get) => {
	const modDetailsByPackageId = new Map<string, InstalledMod>();
	for (const mod of get(installedModsAtom)) {
		const key = normalizedPackageId(mod.packageId);
		if (!modDetailsByPackageId.has(key)) {
			modDetailsByPackageId.set(key, mod);
		}
	}
	return modDetailsByPackageId;
});

export const activeModDiagnosticsAtom = atom((get) =>
	createActiveModDiagnostics(
		get(activeModsAtom),
		get(modDetailsByPackageIdAtom),
		get(gameVersionAtom),
	)
);

export const visibleActiveModsAtom = atom((get) =>
	filterVisibleMods(
		get(activeModsAtom),
		get(modDetailsByPackageIdAtom),
		get(activeSearchAtom),
	)
);

export const visibleInactiveModsAtom = atom((get) =>
	filterVisibleMods(
		get(inactiveModsAtom),
		get(modDetailsByPackageIdAtom),
		get(inactiveSearchAtom),
	)
);

export const hasModListAtom = atom((get) => {
	const sourceName = get(sourceNameAtom);
	const activeMods = get(activeModsAtom);
	const inactiveMods = get(inactiveModsAtom);
	return sourceName.length > 0 || activeMods.length > 0 ||
		inactiveMods.length > 0;
});

export const isModListDirtyAtom = atom((get) =>
	hasModListChanges(get(savedSnapshotAtom), {
		version: get(gameVersionAtom),
		activeMods: get(activeModsAtom),
		knownExpansions: get(knownExpansionsAtom),
	})
);
