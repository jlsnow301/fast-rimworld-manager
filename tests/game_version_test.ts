import { resolveGameVersion } from '@/utils/game_version.ts';

Deno.test('installed RimWorld version takes precedence over config version', () => {
	const version = resolveGameVersion('1.6.4871 rev573', '1.5');
	if (version !== '1.6.4871 rev573') {
		throw new Error(`Expected detected version, got ${version}`);
	}
});

Deno.test('mod-list version is used when installed version is unavailable', () => {
	const version = resolveGameVersion(null, '1.5');
	if (version !== '1.5') {
		throw new Error(`Expected configured version, got ${version}`);
	}
});

Deno.test('default game version remains available without either source', () => {
	const version = resolveGameVersion(null, null);
	if (version !== '1.4') {
		throw new Error(`Expected default version, got ${version}`);
	}
});
