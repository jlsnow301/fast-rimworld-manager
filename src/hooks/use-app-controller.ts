import { open } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { useEffect } from 'react';
import {
	checkingWorkshopUpdatesAtom,
	closeModPreviewAtom,
	databaseMessageAtom,
	downloadingDatabaseAtom,
	installedGameVersionAtom,
	isTestModeAtom,
	pathSettingsAtom,
	selectedModAtom,
	settingsMessageAtom,
	settingsOpenAtom,
	statusAtom,
	steamApiKeyConfiguredAtom,
	steamApiMessageAtom,
	workshopUpdateResultAtom,
} from '../state/app-atoms';
import { normalizedPackageId } from '../utils/mods';
import { ensureDesktopRuntime, invokeDesktop } from '../utils/tauri';
import { steamWorkshopDownloadUrls } from '../utils/workshop_update_urls';
import type {
	DatabaseDownloadResult,
	DatabaseKind,
	DetectedPaths,
	InstalledMod,
	OutdatedWorkshopMod,
	PathSettings,
	WorkshopUpdateCheckResult,
	WorkshopUpdateDispatchResult,
} from '../utils/types';
import { useModLists } from './use-mod-lists';
import { useSteamPreview } from './use-steam-preview';
let steamApiKeyStatusRequest: Promise<boolean> | null = null;

export function useAppController() {
	const [, setSettingsOpen] = useAtom(settingsOpenAtom);
	const [pathSettings, setPathSettings] = useAtom(pathSettingsAtom);
	const [, setSettingsMessage] = useAtom(settingsMessageAtom);
	const [, setDatabaseMessage] = useAtom(databaseMessageAtom);
	const [, setDownloadingDatabase] = useAtom(downloadingDatabaseAtom);
	const [, setStatus] = useAtom(statusAtom);
	const [, setInstalledGameVersion] = useAtom(installedGameVersionAtom);
	const store = useStore();
	const setCheckingWorkshopUpdates = useSetAtom(checkingWorkshopUpdatesAtom);
	const setWorkshopUpdateResult = useSetAtom(workshopUpdateResultAtom);
	const [, setSteamApiKeyConfigured] = useAtom(steamApiKeyConfiguredAtom);
	const [, setSteamApiMessage] = useAtom(steamApiMessageAtom);
	const setSelectedMod = useSetAtom(selectedModAtom);
	const closeModPreview = useSetAtom(closeModPreviewAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const modLists = useModLists(setStatus);
	useSteamPreview();

	useEffect(() => {
		let cancelled = false;
		void refreshSteamApiKeyStatus();

		async function loadConfiguredMods() {
			let settings: PathSettings;
			try {
				settings = await invokeDesktop<PathSettings>(
					'load_path_settings',
				);
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

	async function refreshSteamApiKeyStatus() {
		const statusRequest = steamApiKeyStatusRequest ??
			invokeDesktop<boolean>('steam_api_key_configured');
		steamApiKeyStatusRequest = statusRequest;
		try {
			const configured = await statusRequest;
			setSteamApiKeyConfigured(configured);
			setSteamApiMessage(
				configured
					? 'Steam Web API key is stored in Windows Credential Manager.'
					: 'No Steam Web API key is stored.',
			);
		} catch (error) {
			steamApiKeyStatusRequest = null;
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function saveSteamApiKey(apiKey: string) {
		setSteamApiMessage('Saving Steam Web API key securely…');
		try {
			await invokeDesktop('save_steam_api_key', { apiKey });
			steamApiKeyStatusRequest = Promise.resolve(true);
			setSteamApiKeyConfigured(true);
			setSteamApiMessage('Steam Web API key saved securely.');
			return true;
		} catch (error) {
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
			return false;
		}
	}

	async function testSteamApiConnection() {
		setSteamApiMessage('Testing Steam Web API connection…');
		try {
			await invokeDesktop('test_steam_api_connection');
			steamApiKeyStatusRequest = Promise.resolve(true);
			setSteamApiKeyConfigured(true);
			setSteamApiMessage('Steam Web API connection verified.');
		} catch (error) {
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	async function removeSteamApiKey() {
		setSteamApiMessage('Removing Steam Web API key…');
		try {
			await invokeDesktop('remove_steam_api_key');
			steamApiKeyStatusRequest = Promise.resolve(false);
			setSteamApiKeyConfigured(false);
			setSteamApiMessage('Steam Web API key removed.');
		} catch (error) {
			setSteamApiMessage(
				error instanceof Error ? error.message : String(error),
			);
		}
	}
	return {
		importModList: modLists.importModList,
		moveMod: modLists.moveMod,
		saveModList,
		toggleSettings,
		autoDetectPaths,
		browsePath,
		downloadDatabase,
		savePathSettings,
		updatePath,
		closeModPreview,
		sortMods,
		selectMod,
		checkForModUpdates,
		updateSelectedOutdatedWorkshopMods,
		refreshSteamApiKeyStatus,
		saveSteamApiKey,
		testSteamApiConnection,
		removeSteamApiKey,
	};
}

export type AppController = ReturnType<typeof useAppController>;
