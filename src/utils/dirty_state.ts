export type ModListSnapshot = {
	version: string;
	activeMods: string[];
	knownExpansions: string[];
};

export function createModListSnapshot(
	version: string,
	activeMods: string[],
	knownExpansions: string[],
): ModListSnapshot {
	return {
		version,
		activeMods: [...activeMods],
		knownExpansions: [...knownExpansions],
	};
}

export function hasModListChanges(
	saved: ModListSnapshot,
	current: ModListSnapshot,
): boolean {
	return saved.version !== current.version ||
		!sameItems(saved.activeMods, current.activeMods) ||
		!sameItems(saved.knownExpansions, current.knownExpansions);
}

function sameItems(left: string[], right: string[]) {
	return left.length === right.length &&
		left.every((item, index) => item === right[index]);
}
