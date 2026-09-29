import { steamWorkshopDownloadUrls } from '../src/utils/workshop_update_urls.ts';
import type { OutdatedWorkshopMod } from '../src/utils/types.ts';

function outdatedMod(publishedFileId: string): OutdatedWorkshopMod {
	return {
		name: `Mod ${publishedFileId}`,
		packageId: `sample.mod${publishedFileId}`,
		publishedFileId,
		installedTimeUpdated: 100,
		steamTimeUpdated: 200,
	};
}

Deno.test('bulk updates include each valid outdated Workshop item once', () => {
	const result = steamWorkshopDownloadUrls([
		outdatedMod('123'),
		outdatedMod('456'),
		outdatedMod('123'),
	]);
	const expected = [
		'steam://workshop_download_item/294100/123',
		'steam://workshop_download_item/294100/456',
	];

	if (JSON.stringify(result) !== JSON.stringify(expected)) {
		throw new Error(
			`Expected ${JSON.stringify(expected)}, got ${
				JSON.stringify(result)
			}`,
		);
	}
});

Deno.test('bulk updates discard invalid Workshop identifiers', () => {
	const result = steamWorkshopDownloadUrls([
		outdatedMod(''),
		outdatedMod('0'),
		outdatedMod('steam://openurl/example'),
		outdatedMod('18446744073709551616'),
	]);

	if (result.length !== 0) {
		throw new Error(
			`Invalid Workshop IDs produced URLs: ${JSON.stringify(result)}`,
		);
	}
});
