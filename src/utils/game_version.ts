export const DEFAULT_GAME_VERSION = '1.4';

export function resolveGameVersion(
	detectedVersion: string | null,
	configuredVersion: string | null,
) {
	return detectedVersion?.trim() || configuredVersion?.trim() ||
		DEFAULT_GAME_VERSION;
}
