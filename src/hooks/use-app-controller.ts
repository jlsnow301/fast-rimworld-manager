import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';
import {
	installedGameVersionAtom,
	isTestModeAtom,
	modListLoadStateAtom,
	statusAtom,
} from '@/features/mod-list/atoms';
import { useWorkshopUpdatesController } from '@/features/mod-list/use-workshop-updates-controller';
import {
	closeModPreviewAtom,
	selectedModAtom,
} from '@/features/mod-preview/atoms';
import { settingsOpenAtom } from '@/features/settings/atoms';
import { normalizedPackageId } from '@/utils/mods';
import { invokeDesktop } from '@/utils/tauri';
import { parseModsConfig } from '@/utils/mods_config';
import type { InstalledMod, PathSettings } from '@/utils/types';
import { useModLists } from '@/hooks/use-mod-lists';
import { useSettingsController } from '@/features/settings/use-settings-controller';
import { useSteamApiKeyController } from '@/features/settings/use-steam-api-key-controller';
import { useSteamPreview } from '@/hooks/use-steam-preview';

export function useAppController() {
	const [, setSettingsOpen] = useAtom(settingsOpenAtom);
	const [, setStatus] = useAtom(statusAtom);
	const [, setInstalledGameVersion] = useAtom(installedGameVersionAtom);
	const setModListLoadState = useSetAtom(modListLoadStateAtom);
	const setSelectedMod = useSetAtom(selectedModAtom);
	const closeModPreview = useSetAtom(closeModPreviewAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const modLists = useModLists(setStatus);
	const workshopUpdatesController = useWorkshopUpdatesController(setStatus);
	const settingsController = useSettingsController({
		refreshInstalledMods: modLists.refreshInstalledMods,
		setStatus,
	});
	const steamApiKeyController = useSteamApiKeyController();
	useSteamPreview();

	useEffect(() => {
		let cancelled = false;
		void steamApiKeyController.refreshSteamApiKeyStatus();
		void settingsController.refreshDatabaseStatuses();

		async function loadConfiguredMods() {
			let settings: PathSettings;
			try {
				settings = await invokeDesktop<PathSettings>(
					'load_path_settings',
				);
			} catch (error) {
				if (!cancelled) {
					const message = error instanceof Error
						? error.message
						: String(error);
					settingsController.setSettingsMessage(message);
					setStatus(`Could not load the mod list: ${message}`);
					setModListLoadState('failed');
				}
				return;
			}

			if (cancelled) return;
			settingsController.setPathSettings(settings);
			settingsController.setSettingsMessage('Saved paths loaded.');

			const [configResult, versionResult] = await Promise.allSettled([
				settings.configPath
					? invokeDesktop<string | null>('load_startup_mod_list')
					: Promise.resolve(null),
				settings.gamePath
					? invokeDesktop<string | null>('detect_rimworld_version', {
						gamePath: settings.gamePath,
					})
					: Promise.resolve(null),
			]);
			if (cancelled) return;
			const detectedGameVersion = versionResult.status === 'fulfilled'
				? versionResult.value
				: null;
			setInstalledGameVersion(detectedGameVersion);
			let configuredGameVersion: string | null = null;
			if (configResult.status === 'fulfilled' && configResult.value) {
				try {
					configuredGameVersion =
						parseModsConfig(configResult.value).version;
				} catch {
					configuredGameVersion = null;
				}
			}
			const metadataGameVersion = detectedGameVersion?.trim() ||
				configuredGameVersion || '1.4';
			const [modsResult] = await Promise.allSettled([
				invokeDesktop<InstalledMod[]>('list_installed_mods', {
					gameVersion: metadataGameVersion,
				}),
			]);
			if (cancelled) return;

			const foundMods = modsResult.status === 'fulfilled'
				? modsResult.value
				: [];
			const content = configResult.status === 'fulfilled'
				? configResult.value
				: null;
			const loaded = modLists.initialize(
				foundMods,
				content,
				configResult.status === 'rejected' ? configResult.reason : null,
				modsResult.status === 'rejected' ? modsResult.reason : null,
			);
			setModListLoadState(loaded ? 'loaded' : 'failed');
		}

		void loadConfiguredMods();
		return () => {
			cancelled = true;
		};
	}, []);

	function toggleSettings() {
		setSettingsOpen((open) => !open);
	}

	async function saveModList() {
		if (isTestMode) {
			setStatus('Saving is disabled in test mode.');
			return;
		}
		setStatus('Saving changes…');
		const snapshot = {
			version: modLists.gameVersion,
			activeMods: [...modLists.activeMods],
			knownExpansions: [...modLists.knownExpansions],
		};
		try {
			await invokeDesktop<string>('save_mod_list', {
				args: snapshot,
			});
			modLists.markModListSaved(snapshot);
			setStatus('Changes saved.');
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
		importModList: modLists.importModList,
		moveMod: modLists.moveMod,
		saveModList,
		toggleSettings,
		autoDetectPaths: settingsController.autoDetectPaths,
		browsePath: settingsController.browsePath,
		downloadDatabase: settingsController.downloadDatabase,
		savePathSettings: settingsController.savePathSettings,
		updatePath: settingsController.updatePath,
		closeModPreview,
		sortMods,
		selectMod,
		checkForModUpdates: workshopUpdatesController.checkForModUpdates,
		updateSelectedOutdatedWorkshopMods:
			workshopUpdatesController.updateSelectedOutdatedWorkshopMods,
		refreshSteamApiKeyStatus:
			steamApiKeyController.refreshSteamApiKeyStatus,
		saveSteamApiKey: steamApiKeyController.saveSteamApiKey,
		testSteamApiConnection: steamApiKeyController.testSteamApiConnection,
		removeSteamApiKey: steamApiKeyController.removeSteamApiKey,
	};
}

export type AppController = ReturnType<typeof useAppController>;
