import { open } from '@tauri-apps/plugin-dialog';
import { useEffect, useState } from 'react';
import { EMPTY_PATH_SETTINGS, normalizedPackageId } from '../utils/mods';
import { ensureDesktopRuntime, invokeDesktop } from '../utils/tauri';
import type {
	DatabaseDownloadResult,
	DatabaseKind,
	DetectedPaths,
	InstalledMod,
	PathSettings,
} from '../utils/types';
import { useModLists } from './use-mod-lists';
import { useSteamPreview } from './use-steam-preview';

export function useAppController() {
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [pathSettings, setPathSettings] = useState<PathSettings>(
		EMPTY_PATH_SETTINGS,
	);
	const [settingsMessage, setSettingsMessage] = useState(
		'Loading saved paths.',
	);
	const [databaseMessage, setDatabaseMessage] = useState(
		'Databases are saved in the app data folder.',
	);
	const [downloadingDatabase, setDownloadingDatabase] = useState<
		DatabaseKind | null
	>(null);
	const [status, setStatus] = useState(
		'Waiting for configured mods. Set the RimWorld paths in Settings.',
	);
	const [selectedMod, setSelectedMod] = useState<InstalledMod | null>(null);
	const modLists = useModLists(setStatus);
	const { previewMessage, steamPreview } = useSteamPreview(selectedMod);

	useEffect(() => {
		let cancelled = false;

		async function loadConfiguredMods() {
			let settings: PathSettings;
			try {
				settings = await invokeDesktop<PathSettings>('load_path_settings');
			} catch (error) {
				if (!cancelled) {
					setSettingsMessage(
						error instanceof Error ? error.message : String(error),
					);
				}
				return;
			}

			if (cancelled) return;
			setPathSettings(settings);
			setSettingsMessage('Saved paths loaded.');

			const [modsResult, configResult] = await Promise.allSettled([
				invokeDesktop<InstalledMod[]>('list_installed_mods'),
				settings.configPath
					? invokeDesktop<string | null>('load_startup_mod_list')
					: Promise.resolve(null),
			]);
			if (cancelled) return;

			const foundMods = modsResult.status === 'fulfilled'
				? modsResult.value
				: [];
			const content = configResult.status === 'fulfilled'
				? configResult.value
				: null;
			modLists.initialize(
				foundMods,
				content,
				configResult.status === 'rejected' ? configResult.reason : null,
				modsResult.status === 'rejected' ? modsResult.reason : null,
				Boolean(settings.configPath),
			);
		}

		void loadConfiguredMods();
		return () => {
			cancelled = true;
		};
	}, []);

	function toggleSettings() {
		setSettingsOpen((open) => !open);
	}

	function updatePath(key: keyof PathSettings, value: string) {
		setPathSettings((settings) => ({ ...settings, [key]: value }));
	}
	async function browsePath(key: keyof PathSettings, label: string) {
		try {
			ensureDesktopRuntime();
			const selectedPath = await open({
				defaultPath: pathSettings[key] || undefined,
				directory: true,
				multiple: false,
				title: `Choose ${label}`,
			});
			if (typeof selectedPath !== 'string') return;

			updatePath(key, selectedPath);
			setSettingsMessage(`${label} selected. Save paths to apply it.`);
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function autoDetectPaths() {
		setSettingsMessage('Looking for RimWorld and Steam folders…');
		try {
			const detected = await invokeDesktop<DetectedPaths>(
				'detect_rimworld_paths',
			);
			const updates: Partial<PathSettings> = {};
			for (const key of Object.keys(detected) as (keyof PathSettings)[]) {
				const detectedPath = detected[key];
				if (detectedPath && !pathSettings[key]) {
					updates[key] = detectedPath;
				}
			}
			setPathSettings((settings) => ({ ...settings, ...updates }));
			const foundCount = Object.keys(updates).length;
			setSettingsMessage(
				foundCount
					? `Detected ${foundCount} path${
						foundCount === 1 ? '' : 's'
					}. Review and save them.`
					: 'No RimWorld paths found. Enter paths manually.',
			);
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function savePathSettings() {
		setSettingsMessage('Saving paths…');
		try {
			await invokeDesktop('save_path_settings', { settings: pathSettings });
			setSettingsMessage('Paths saved.');
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
			return;
		}

		try {
			const foundMods = await invokeDesktop<InstalledMod[]>(
				'list_installed_mods',
			);
			modLists.refreshInstalledMods(foundMods);
			setStatus(`Found ${foundMods.length} installed mods.`);
		} catch (error) {
			setSettingsMessage(
				`Paths saved, but mod scanning failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}
	async function downloadDatabase(database: DatabaseKind) {
		setDownloadingDatabase(database);
		setDatabaseMessage(
			`Downloading ${
				database === 'communityRules' ? 'Community Rules' : 'Steam Workshop'
			} database…`,
		);
		try {
			const result = await invokeDesktop<DatabaseDownloadResult>(
				'download_database',
				{ database },
			);
			const displayName = result.database === 'communityRules'
				? 'Community Rules'
				: 'Steam Workshop';
			try {
				const foundMods = await invokeDesktop<InstalledMod[]>(
					'list_installed_mods',
				);
				modLists.refreshInstalledMods(foundMods);
				setDatabaseMessage(
					`Updated ${displayName} database (${result.bytesDownloaded.toLocaleString()} bytes). Mod highlights refreshed.`,
				);
			} catch (error) {
				setDatabaseMessage(
					`Updated ${displayName} database, but installed mods could not be refreshed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		} catch (error) {
			setDatabaseMessage(
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			setDownloadingDatabase(null);
		}
	}

	async function saveModList() {
		setStatus('Saving ModsConfig.xml…');
		const snapshot = {
			version: modLists.gameVersion,
			activeMods: [...modLists.activeMods],
			knownExpansions: [...modLists.knownExpansions],
		};
		try {
			const path = await invokeDesktop<string>('save_mod_list', {
				args: snapshot,
			});
			modLists.markModListSaved(snapshot);
			setStatus(`Saved ModsConfig.xml to ${path}.`);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
		}
	}

	async function sortMods() {
		if (modLists.activeMods.length < 2) return;
		setStatus('Sorting active mods…');
		try {
			const sorted = await invokeDesktop<string[]>('sort_active_mods', {
				activeMods: modLists.activeMods,
			});
			modLists.applySortedActiveMods(sorted);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
		}
	}

	function selectMod(packageId: string) {
		const mod = modLists.modDetailsByPackageId.get(
			normalizedPackageId(packageId),
		);
		if (mod) setSelectedMod(mod);
	}

	return {
		...modLists,
		databaseMessage,
		downloadDatabase,
		downloadingDatabase,
		browsePath,
		autoDetectPaths,
		closeModPreview: () => setSelectedMod(null),
		pathSettings,
		previewMessage,
		saveModList,
		savePathSettings,
		selectedMod,
		selectMod,
		settingsMessage,
		settingsOpen,
		status,
		steamPreview,
		toggleSettings,
		updatePath,
		sortMods,
	};
}

export type AppController = ReturnType<typeof useAppController>;
