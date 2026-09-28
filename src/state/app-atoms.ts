import { atom } from 'jotai';
import { createModListSnapshot, hasModListChanges } from '../utils/dirty_state';
import { createActiveModDiagnostics } from '../utils/mod_highlights';
import { filterVisibleMods } from '../utils/mod_search';
import { EMPTY_PATH_SETTINGS, normalizedPackageId } from '../utils/mods';
import type { ModListSnapshot } from '../utils/dirty_state';
import type {
	DatabaseKind,
	InstalledMod,
	OutdatedWorkshopMod,
	PathSettings,
	SteamModPreview,
	WorkshopUpdateCheckResult,
} from '../utils/types';
import { TEST_MOD_LIST } from '../utils/test_mod_list';

export const settingsOpenAtom = atom(false);
export const pathSettingsAtom = atom<PathSettings>(EMPTY_PATH_SETTINGS);
export const settingsMessageAtom = atom('Loading saved paths.');
export const databaseMessageAtom = atom(
	'Databases are saved in the app data folder.',
);
export const steamApiKeyConfiguredAtom = atom(false);
export const steamApiMessageAtom = atom(
	'Steam Web API key status has not been checked.',
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
export const workshopUpdateResultAtom = atom<WorkshopUpdateCheckResult | null>(
	null,
);
export const checkingWorkshopUpdatesAtom = atom(false);
export const outdatedWorkshopModsByPackageIdAtom = atom((get) => {
	const result = get(workshopUpdateResultAtom);
	const updates = new Map<string, OutdatedWorkshopMod>();
	for (const mod of result?.outdatedMods ?? []) {
		updates.set(normalizedPackageId(mod.packageId), mod);
	}
	return updates;
});

type TestModeBackup = {
	installedMods: InstalledMod[];
	activeMods: string[];
	inactiveMods: string[];
	knownExpansions: string[];
	gameVersion: string;
	sourceName: string;
	savedSnapshot: ModListSnapshot;
	activeSearch: string;
	inactiveSearch: string;
	workshopUpdateResult: WorkshopUpdateCheckResult | null;
};

export const isTestModeAtom = atom(false);
const testModeBackupAtom = atom<TestModeBackup | null>(null);

export const toggleTestModeAtom = atom(null, (get, set) => {
	const backup = get(testModeBackupAtom);
	if (get(isTestModeAtom) && backup) {
		set(installedModsAtom, backup.installedMods);
		set(activeModsAtom, backup.activeMods);
		set(inactiveModsAtom, backup.inactiveMods);
		set(knownExpansionsAtom, backup.knownExpansions);
		set(gameVersionAtom, backup.gameVersion);
		set(sourceNameAtom, backup.sourceName);
		set(savedSnapshotAtom, backup.savedSnapshot);
		set(activeSearchAtom, backup.activeSearch);
		set(inactiveSearchAtom, backup.inactiveSearch);
		set(workshopUpdateResultAtom, backup.workshopUpdateResult);
		set(testModeBackupAtom, null);
		set(isTestModeAtom, false);
		set(selectedModAtom, null);
		set(steamPreviewAtom, null);
		set(previewMessageAtom, '');
		set(statusAtom, 'Exited test mode and restored the previous mod list.');
		return;
	}

	if (get(isTestModeAtom)) return;
	set(testModeBackupAtom, {
		installedMods: get(installedModsAtom),
		activeMods: get(activeModsAtom),
		inactiveMods: get(inactiveModsAtom),
		knownExpansions: get(knownExpansionsAtom),
		gameVersion: get(gameVersionAtom),
		sourceName: get(sourceNameAtom),
		savedSnapshot: get(savedSnapshotAtom),
		activeSearch: get(activeSearchAtom),
		inactiveSearch: get(inactiveSearchAtom),
		workshopUpdateResult: get(workshopUpdateResultAtom),
	});
	set(installedModsAtom, TEST_MOD_LIST.installedMods);
	set(activeModsAtom, [...TEST_MOD_LIST.modList.activeMods]);
	set(
		inactiveModsAtom,
		TEST_MOD_LIST.installedMods
			.filter((mod) =>
				!TEST_MOD_LIST.modList.activeMods.includes(mod.packageId)
			)
			.map((mod) => mod.packageId),
	);
	set(knownExpansionsAtom, [...TEST_MOD_LIST.modList.knownExpansions]);
	set(gameVersionAtom, TEST_MOD_LIST.modList.version);
	set(sourceNameAtom, 'Sample test mod list');
	set(
		savedSnapshotAtom,
		createModListSnapshot(
			TEST_MOD_LIST.modList.version,
			TEST_MOD_LIST.modList.activeMods,
			TEST_MOD_LIST.modList.knownExpansions,
		),
	);
	set(activeSearchAtom, '');
	set(inactiveSearchAtom, '');
	set(workshopUpdateResultAtom, TEST_MOD_LIST.updateCheckResult);
	set(checkingWorkshopUpdatesAtom, false);
	set(isTestModeAtom, true);
	set(selectedModAtom, null);
	set(steamPreviewAtom, null);
	set(previewMessageAtom, '');
	set(
		statusAtom,
		'Test mode loaded. Changes stay in memory and cannot be saved to RimWorld.',
	);
});

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
export const hasWorkshopModsAtom = atom((get) =>
	get(installedModsAtom).some(
		(mod) => mod.source === 'workshop' && mod.publishedFileId !== null,
	)
);

export const isModListDirtyAtom = atom((get) =>
	hasModListChanges(get(savedSnapshotAtom), {
		version: get(gameVersionAtom),
		activeMods: get(activeModsAtom),
		knownExpansions: get(knownExpansionsAtom),
	})
);
