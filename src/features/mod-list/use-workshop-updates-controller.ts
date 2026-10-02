import { openUrl } from '@tauri-apps/plugin-opener';
import { useSetAtom, useStore } from 'jotai';
import {
	checkingWorkshopUpdatesAtom,
	isTestModeAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms';
import { ensureDesktopRuntime, invokeDesktop } from '@/utils/tauri';
import { steamWorkshopDownloadUrls } from '@/utils/workshop_update_urls';
import type {
	OutdatedWorkshopMod,
	WorkshopUpdateCheckResult,
	WorkshopUpdateDispatchResult,
} from '@/utils/types';

type WorkshopStatusSetter = (message: string) => void;

export function useWorkshopUpdatesController(setStatus: WorkshopStatusSetter) {
	const store = useStore();
	const setCheckingWorkshopUpdates = useSetAtom(
		checkingWorkshopUpdatesAtom,
	);
	const setWorkshopUpdateResult = useSetAtom(workshopUpdateResultAtom);

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

	return { checkForModUpdates, updateSelectedOutdatedWorkshopMods };
}
