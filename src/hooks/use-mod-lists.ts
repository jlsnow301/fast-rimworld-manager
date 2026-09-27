import { useState } from 'react';
import { getInactivePackageIds, normalizedPackageId } from '../utils/mods';
import { moveModBetweenLists } from '../utils/mod_lists';
import { parseModsConfig } from '../utils/mods_config';
import {
	createModListSnapshot,
	hasModListChanges,
	type ModListSnapshot,
} from '../utils/dirty_state';
import type { InstalledMod, ModListType, VisibleMod } from '../utils/types';

export function useModLists(setStatus: (message: string) => void) {
	const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
	const [activeMods, setActiveMods] = useState<string[]>([]);
	const [inactiveMods, setInactiveMods] = useState<string[]>([]);
	const [knownExpansions, setKnownExpansions] = useState<string[]>([]);
	const [gameVersion, setGameVersion] = useState('1.4');
	const [sourceName, setSourceName] = useState('');
	const [activeSearch, setActiveSearch] = useState('');
	const [inactiveSearch, setInactiveSearch] = useState('');
	const [savedSnapshot, setSavedSnapshot] = useState(() =>
		createModListSnapshot('1.4', [], [])
	);

	function initialize(
		foundMods: InstalledMod[],
		content: string | null,
		configError: unknown,
		modsError: unknown,
		configPathConfigured: boolean,
	) {
		setSavedSnapshot(createModListSnapshot('1.4', [], []));
		setInstalledMods(foundMods);
		setActiveMods([]);
		setInactiveMods(getInactivePackageIds(foundMods, []));

		if (content) {
			try {
				const parsed = parseModsConfig(content);
				setActiveMods(parsed.activeMods);
				setInactiveMods(getInactivePackageIds(foundMods, parsed.activeMods));
				setKnownExpansions(parsed.knownExpansions);
				setGameVersion(parsed.version);
				setSavedSnapshot(
					createModListSnapshot(
						parsed.version,
						parsed.activeMods,
						parsed.knownExpansions,
					),
				);
				setSourceName('ModsConfig.xml');
				setStatus(
					`Loaded ${parsed.activeMods.length} active mods and found ${foundMods.length} installed mods.`,
				);
			} catch (error) {
				setStatus(error instanceof Error ? error.message : String(error));
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
		setInstalledMods(foundMods);
		setInactiveMods(getInactivePackageIds(foundMods, activeMods));
	}

	function applyModList(content: string, source: string, mods = installedMods) {
		const parsed = parseModsConfig(content);
		setActiveMods(parsed.activeMods);
		setInactiveMods(getInactivePackageIds(mods, parsed.activeMods));
		setKnownExpansions(parsed.knownExpansions);
		setGameVersion(parsed.version);
		setSourceName(source);
		return parsed;
	}

	async function importModList(file: File | null) {
		if (!file) return;

		try {
			const parsed = applyModList(await file.text(), file.name);
			setStatus(
				`Loaded ${parsed.activeMods.length} active mods from ${file.name}.`,
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
	const isModListDirty = hasModListChanges(savedSnapshot, {
		version: gameVersion,
		activeMods,
		knownExpansions,
	});

	const modDetailsByPackageId = new Map<string, InstalledMod>();
	for (const mod of installedMods) {
		const key = normalizedPackageId(mod.packageId);
		if (!modDetailsByPackageId.has(key)) modDetailsByPackageId.set(key, mod);
	}
	const visibleMods = (mods: string[], search: string): VisibleMod[] =>
		mods
			.map((packageId, index) => ({ packageId, index }))
			.filter(({ packageId }) =>
				packageId.toLowerCase().includes(search.toLowerCase())
			);

	return {
		activeMods,
		activeSearch,
		gameVersion,
		knownExpansions,
		hasModList: sourceName.length > 0 || activeMods.length > 0 ||
			inactiveMods.length > 0,
		inactiveMods,
		inactiveSearch,
		initialize,
		importModList,
		modDetailsByPackageId,
		moveMod,
		refreshInstalledMods,
		setActiveSearch,
		setInactiveSearch,
		sourceName,
		visibleActiveMods: visibleMods(activeMods, activeSearch),
		visibleInactiveMods: visibleMods(inactiveMods, inactiveSearch),
		isModListDirty,
		markModListSaved,
		applySortedActiveMods,
	};
}
