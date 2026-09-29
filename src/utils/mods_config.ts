import type { ModListFile } from './types';

export function parseModsConfig(content: string): ModListFile {
	const document = new DOMParser().parseFromString(
		content,
		'application/xml',
	);
	const root = document.querySelector('ModsConfigData');

	if (document.querySelector('parsererror') || !root) {
		throw new Error(
			'This file is not a valid RimWorld ModsConfig.xml file.',
		);
	}

	const activeMods = Array.from(root.querySelectorAll('activeMods > li'))
		.map((entry) => entry.textContent?.trim() ?? '')
		.filter(Boolean);
	const knownExpansions = Array.from(
		root.querySelectorAll('knownExpansions > li'),
	)
		.map((entry) => entry.textContent?.trim() ?? '')
		.filter(Boolean);

	return {
		activeMods,
		knownExpansions,
		version: root.querySelector('version')?.textContent?.trim() || '1.4',
	};
}
