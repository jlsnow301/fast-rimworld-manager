import { openUrl } from '@tauri-apps/plugin-opener';
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { useEffect } from 'react';
import {
	checkingWorkshopUpdatesAtom,
	installedGameVersionAtom,
	isTestModeAtom,
	statusAtom,
	workshopUpdateResultAtom,
} from '../features/mod-list/atoms';
import {
	closeModPreviewAtom,
	selectedModAtom,
} from '../features/mod-preview/atoms';
import { settingsOpenAtom } from '../features/settings/atoms';
import { normalizedPackageId } from '../utils/mods';
import { ensureDesktopRuntime, invokeDesktop } from '../utils/tauri';
import { steamWorkshopDownloadUrls } from '../utils/workshop_update_urls';
import type {
	InstalledMod,
	OutdatedWorkshopMod,
	PathSettings,
	WorkshopUpdateCheckResult,
	WorkshopUpdateDispatchResult,
} from '../utils/types';
import { useModLists } from './use-mod-lists';
import { useSettingsController } from '../features/settings/use-settings-controller';
import { useSteamApiKeyController } from '../features/settings/use-steam-api-key-controller';
import { useSteamPreview } from './use-steam-preview';

export function useAppController() {
	const [, setSettingsOpen] = useAtom(settingsOpenAtom);
	const [, setStatus] = useAtom(statusAtom);
	const [, setInstalledGameVersion] = useAtom(installedGameVersionAtom);
	const store = useStore();
	const setCheckingWorkshopUpdates = useSetAtom(checkingWorkshopUpdatesAtom);
	const setWorkshopUpdateResult = useSetAtom(workshopUpdateResultAtom);
	const setSelectedMod = useSetAtom(selectedModAtom);
	const closeModPreview = useSetAtom(closeModPreviewAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const modLists = useModLists(setStatus);
	const settingsController = useSettingsController({
		refreshInstalledMods: modLists.refreshInstalledMods,
		setStatus,
	});
	const steamApiKeyController = useSteamApiKeyController();
	useSteamPreview();

	useEffect(() => {
		let cancelled = false;
		void steamApiKeyController.refreshSteamApiKeyStatus();

		async function loadConfiguredMods() {
			let settings: PathSettings;
			try {
				settings = await invokeDesktop<PathSettings>(
					'load_path_settings',
				);
			} catch (error) {
				if (!cancelled) {
					settingsController.setSettingsMessage(
						error instanceof Error ? error.message : String(error),
					);
				}
				return;
			}

			if (cancelled) return;
			settingsController.setPathSettings(settings);
			settingsController.setSettingsMessage('Saved paths loaded.');

			const [modsResult, configResult, versionResult] = await Promise
				.allSettled([
					invokeDesktop<InstalledMod[]>('list_installed_mods'),
					settings.configPath
						? invokeDesktop<string | null>('load_startup_mod_list')
						: Promise.resolve(null),
					settings.gamePath
						? invokeDesktop<string | null>(
							'detect_rimworld_version',
							{
								gamePath: settings.gamePath,
							},
						)
						: Promise.resolve(null),
				]);
			if (cancelled) return;
			setInstalledGameVersion(
				versionResult.status === 'fulfilled'
					? versionResult.value
					: null,
			);

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

	async function saveModList() {
		if (isTestMode) {
			setStatus('Saving is disabled in test mode.');
			return;
		}
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

	async function checkForModUpdates(): Promise<
		WorkshopUpdateCheckResult | null
	> {
		if (store.get(isTestModeAtom)) {
			const result = store.get(workshopUpdateResultAtom);
			setStatus(
				'Test mode: showing sample Workshop update results. Downloads are disabled.',
			);
			return result;
		}
		setCheckingWorkshopUpdates(true);
		setWorkshopUpdateResult(null);
		setStatus('Checking installed Workshop mods for updates…');
		try {
			const result = await invokeDesktop<WorkshopUpdateCheckResult>(
				'check_outdated_mods',
			);
			if (store.get(isTestModeAtom)) return null;
			setWorkshopUpdateResult(result);
			const updateCount = result.outdatedMods.length;
			const skipped = result.skippedCount
				? ` ${result.skippedCount} could not be compared.`
				: '';
			setStatus(
				`Checked ${result.checkedCount} Workshop mods; ${updateCount} update${
					updateCount === 1 ? '' : 's'
				} available.${skipped}`,
			);
			return result;
		} catch (error) {
			if (!store.get(isTestModeAtom)) {
				setStatus(
					error instanceof Error ? error.message : String(error),
				);
			}
			return null;
		} finally {
			setCheckingWorkshopUpdates(false);
		}
	}

	async function updateSelectedOutdatedWorkshopMods(
		selectedMods: readonly OutdatedWorkshopMod[],
	): Promise<WorkshopUpdateDispatchResult> {
		if (selectedMods.length === 0) {
			setStatus('No Workshop mods selected for update.');
			return { openedCount: 0, failedCount: 0 };
		}
		if (store.get(isTestModeAtom)) {
			setStatus('Workshop downloads are disabled in test mode.');
			return { openedCount: 0, failedCount: 0 };
		}
		const urls = steamWorkshopDownloadUrls(selectedMods);
		if (urls.length === 0) {
			setStatus(
				'No valid outdated Workshop items are selected for update.',
			);
			return { openedCount: 0, failedCount: 0 };
		}
		try {
			ensureDesktopRuntime();
		} catch (error) {
			setStatus(error instanceof Error ? error.message : String(error));
			return { openedCount: 0, failedCount: urls.length };
		}

		let openedCount = 0;
		let failedCount = 0;
		for (const url of urls) {
			try {
				await openUrl(url);
				openedCount += 1;
			} catch {
				failedCount += 1;
			}
		}

		const failureMessage = failedCount > 0
			? ` ${failedCount} request(s) could not be sent.`
			: '';
		setStatus(
			`Sent ${openedCount} of ${urls.length} Workshop update requests to Steam.${failureMessage} Keep Steam running and signed in.`,
		);
		return { openedCount, failedCount };
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
		checkForModUpdates,
		updateSelectedOutdatedWorkshopMods,
		refreshSteamApiKeyStatus:
			steamApiKeyController.refreshSteamApiKeyStatus,
		saveSteamApiKey: steamApiKeyController.saveSteamApiKey,
		testSteamApiConnection: steamApiKeyController.testSteamApiConnection,
		removeSteamApiKey: steamApiKeyController.removeSteamApiKey,
	};
}

export type AppController = ReturnType<typeof useAppController>;
