import type { ModListFile } from './types';

export function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function parseModsConfig(content: string): ModListFile {
	const document = new DOMParser().parseFromString(content, 'application/xml');
	const root = document.querySelector('ModsConfigData');

	if (document.querySelector('parsererror') || !root) {
		throw new Error('This file is not a valid RimWorld ModsConfig.xml file.');
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

export function serializeModsConfig(
	version: string,
	activeMods: string[],
	knownExpansions: string[],
) {
	return [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<ModsConfigData>',
		`  <version>${escapeXml(version)}</version>`,
		'  <activeMods>',
		...activeMods.map((mod) => `    <li>${escapeXml(mod)}</li>`),
		'  </activeMods>',
		'  <knownExpansions>',
		...knownExpansions.map((expansion) =>
			`    <li>${escapeXml(expansion)}</li>`
		),
		'  </knownExpansions>',
		'</ModsConfigData>',
	].join('\n');
}
