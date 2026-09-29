import { open } from '@tauri-apps/plugin-dialog';
import { useAtom, useStore } from 'jotai';
import { ensureDesktopRuntime, invokeDesktop } from '@/utils/tauri';
import type {
	DatabaseDownloadResult,
	DatabaseKind,
	DetectedPaths,
	InstalledMod,
	PathSettings,
} from '@/utils/types';
import {
	installedGameVersionAtom,
	isTestModeAtom,
} from '@/features/mod-list/atoms';
import {
	databaseMessageAtom,
	downloadingDatabaseAtom,
	pathSettingsAtom,
	settingsMessageAtom,
} from '@/features/settings/atoms';

type RefreshInstalledMods = (mods: InstalledMod[]) => void;
type SetStatus = (message: string) => void;

type SettingsControllerOptions = {
	refreshInstalledMods: RefreshInstalledMods;
	setStatus: SetStatus;
};

export function useSettingsController(props: SettingsControllerOptions) {
	const { refreshInstalledMods, setStatus } = props;
	const [pathSettings, setPathSettings] = useAtom(pathSettingsAtom);
	const [, setSettingsMessage] = useAtom(settingsMessageAtom);
	const [, setDatabaseMessage] = useAtom(databaseMessageAtom);
	const [, setDownloadingDatabase] = useAtom(downloadingDatabaseAtom);
	const [, setInstalledGameVersion] = useAtom(installedGameVersionAtom);
	const store = useStore();

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

	async function refreshInstalledGameVersion(gamePath: string) {
		if (store.get(isTestModeAtom)) return;
		if (!gamePath.trim()) {
			setInstalledGameVersion(null);
			return;
		}
		try {
			const version = await invokeDesktop<string | null>(
				'detect_rimworld_version',
				{ gamePath },
			);
			setInstalledGameVersion(version);
		} catch {
			setInstalledGameVersion(null);
		}
	}

	async function savePathSettings() {
		setSettingsMessage('Saving paths…');
		try {
			await invokeDesktop('save_path_settings', {
				settings: pathSettings,
			});
			setSettingsMessage('Paths saved.');
		} catch (error) {
			setSettingsMessage(
				error instanceof Error ? error.message : String(error),
			);
			return;
		}
		await refreshInstalledGameVersion(pathSettings.gamePath);

		try {
			const foundMods = await invokeDesktop<InstalledMod[]>(
				'list_installed_mods',
			);
			refreshInstalledMods(foundMods);
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
				database === 'communityRules'
					? 'Community Rules'
					: 'Steam Workshop'
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
				refreshInstalledMods(foundMods);
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
	return {
		pathSettings,
		setPathSettings,
		setSettingsMessage,
		updatePath,
		browsePath,
		autoDetectPaths,
		savePathSettings,
		downloadDatabase,
	};
}
