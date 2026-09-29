import type { OutdatedWorkshopMod } from '@/utils/types';

const WORKSHOP_ID_PATTERN = /^[0-9]+$/;
const MAX_WORKSHOP_ID = '18446744073709551615';
const RIMWORLD_APP_ID = '294100';

export function steamWorkshopDownloadUrls(
	outdatedMods: readonly OutdatedWorkshopMod[],
): string[] {
	const seenIds = new Set<string>();
	const urls: string[] = [];

	for (const mod of outdatedMods) {
		const publishedFileId = mod.publishedFileId.trim();
		if (
			!WORKSHOP_ID_PATTERN.test(publishedFileId) ||
			/^0+$/.test(publishedFileId) ||
			publishedFileId.length > MAX_WORKSHOP_ID.length ||
			(publishedFileId.length === MAX_WORKSHOP_ID.length &&
				publishedFileId > MAX_WORKSHOP_ID) ||
			seenIds.has(publishedFileId)
		) {
			continue;
		}

		seenIds.add(publishedFileId);
		urls.push(
			`steam://workshop_download_item/${RIMWORLD_APP_ID}/${publishedFileId}`,
		);
	}

	return urls;
}
