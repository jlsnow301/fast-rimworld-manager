import { open } from '@tauri-apps/plugin-dialog';
import { useAtom, useAtomValue, useStore } from 'jotai';
import { ensureDesktopRuntime, invokeDesktop } from '@/utils/tauri';
import { getInactivePackageIds } from '@/utils/mods';
import { moveModBetweenLists } from '@/utils/mod_lists';
import { parseModsConfig } from '@/utils/mods_config';
import {
	createModListSnapshot,
	type ModListSnapshot,
} from '@/utils/dirty_state';
import type {
	ImportedModListFile,
	InstalledMod,
	ModListType,
} from '@/utils/types';
import {
	activeModDiagnosticsAtom,
	activeModsAtom,
	activeSearchAtom,
	configuredGameVersionAtom,
	gameVersionAtom,
	hasModListAtom,
	inactiveModsAtom,
	inactiveSearchAtom,
	installedModsAtom,
	isModListDirtyAtom,
	isTestModeAtom,
	knownExpansionsAtom,
	modDetailsByPackageIdAtom,
	savedSnapshotAtom,
	sourceNameAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms';

export function useModLists(setStatus: (message: string) => void) {
	const store = useStore();
	const [installedMods, setInstalledMods] = useAtom(installedModsAtom);
	const [activeMods, setActiveMods] = useAtom(activeModsAtom);
	const [inactiveMods, setInactiveMods] = useAtom(inactiveModsAtom);
	const [knownExpansions, setKnownExpansions] = useAtom(knownExpansionsAtom);
	const gameVersion = useAtomValue(gameVersionAtom);
	const [sourceName, setSourceName] = useAtom(sourceNameAtom);
	const [activeSearch, setActiveSearch] = useAtom(activeSearchAtom);
	const [inactiveSearch, setInactiveSearch] = useAtom(inactiveSearchAtom);
	const [, setSavedSnapshot] = useAtom(savedSnapshotAtom);
	const [, setWorkshopUpdateResult] = useAtom(workshopUpdateResultAtom);
	const [, setConfiguredGameVersion] = useAtom(configuredGameVersionAtom);

	function initialize(
		foundMods: InstalledMod[],
		content: string | null,
		configError: unknown,
		modsError: unknown,
		configPathConfigured: boolean,
	) {
		if (store.get(isTestModeAtom)) return;
		setConfiguredGameVersion(null);
		setSavedSnapshot(
			createModListSnapshot(store.get(gameVersionAtom), [], []),
		);
		setInstalledMods(foundMods);
		setActiveMods([]);
		setInactiveMods(getInactivePackageIds(foundMods, null));
		setSourceName('');
		setWorkshopUpdateResult(null);

		if (content) {
			try {
				const parsed = parseModsConfig(content);
				setActiveMods(parsed.activeMods);
				setInactiveMods(
					getInactivePackageIds(foundMods, parsed.activeMods),
				);
				setConfiguredGameVersion(parsed.version);
				setKnownExpansions(parsed.knownExpansions);
				setSavedSnapshot(
					createModListSnapshot(
						store.get(gameVersionAtom),
						parsed.activeMods,
						parsed.knownExpansions,
					),
				);
				setSourceName('ModsConfig.xml');
				setStatus(
					`Loaded ${parsed.activeMods.length} active mods and found ${foundMods.length} installed mods.`,
				);
			} catch (error) {
				setStatus(
					error instanceof Error ? error.message : String(error),
				);
			}
			return;
		}

		if (configError !== null) {
			setStatus(String(configError));
		} else if (configPathConfigured) {
			setStatus(
				`No ModsConfig.xml found. Found ${foundMods.length} installed mods.`,
			);
		} else if (modsError !== null) {
			setStatus(String(modsError));
		} else if (foundMods.length > 0) {
			setStatus(`Found ${foundMods.length} installed mods.`);
		}
	}

	function refreshInstalledMods(foundMods: InstalledMod[]) {
		if (store.get(isTestModeAtom)) return;
		setInstalledMods(foundMods);
		setWorkshopUpdateResult(null);
		setInactiveMods(
			getInactivePackageIds(
				foundMods,
				sourceName ? activeMods : null,
			),
		);
	}

	function applyModList(
		content: string,
		source: string,
		mods = installedMods,
	) {
		const parsed = parseModsConfig(content);
		setActiveMods(parsed.activeMods);
		setInactiveMods(getInactivePackageIds(mods, parsed.activeMods));
		setKnownExpansions(parsed.knownExpansions);
		setConfiguredGameVersion(parsed.version);
		setSourceName(source);
		return parsed;
	}

	async function importModList() {
		try {
			ensureDesktopRuntime();
			const path = await open({
				filters: [{ name: 'XML files', extensions: ['xml'] }],
				multiple: false,
				title: 'Import RimWorld mod list',
			});
			if (typeof path !== 'string') return;

			const imported = await invokeDesktop<ImportedModListFile>(
				'load_mod_list_file',
				{ path },
			);
			if (store.get(isTestModeAtom)) return;
			const parsed = applyModList(imported.contents, imported.fileName);
			setStatus(
				`Loaded ${parsed.activeMods.length} active mods from ${imported.fileName}.`,
			);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: 'Could not read this mod list.',
			);
		}
	}

	function applySortedActiveMods(sortedMods: string[]) {
		setActiveMods(sortedMods);
		setStatus('Active mods sorted by load-order rules.');
	}

	function moveMod(index: number, source: ModListType, target: ModListType) {
		if (source === target) return;

		const transfer = moveModBetweenLists(
			activeMods,
			inactiveMods,
			index,
			source,
		);
		if (!transfer) return;

		setActiveMods(transfer.active);
		setInactiveMods(transfer.inactive);
		setStatus(`Moved ${transfer.packageId} to ${target} mods.`);
	}
	function markModListSaved(snapshot: ModListSnapshot) {
		setSavedSnapshot(
			createModListSnapshot(
				snapshot.version,
				snapshot.activeMods,
				snapshot.knownExpansions,
			),
		);
	}
	const isModListDirty = useAtomValue(isModListDirtyAtom);
	const hasModList = useAtomValue(hasModListAtom);
	const modDetailsByPackageId = useAtomValue(modDetailsByPackageIdAtom);
	const activeModDiagnostics = useAtomValue(activeModDiagnosticsAtom);
	const visibleActiveMods = useAtomValue(visibleActiveModsAtom);
	const visibleInactiveMods = useAtomValue(visibleInactiveModsAtom);
	return {
		activeMods,
		activeSearch,
		gameVersion,
		knownExpansions,
		hasModList,
		inactiveMods,
		inactiveSearch,
		initialize,
		importModList,
		modDetailsByPackageId,
		activeModDiagnostics,
		moveMod,
		refreshInstalledMods,
		setActiveSearch,
		setInactiveSearch,
		sourceName,
		visibleActiveMods,
		visibleInactiveMods,
		isModListDirty,
		markModListSaved,
		applySortedActiveMods,
	};
}
