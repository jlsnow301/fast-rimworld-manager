import type { ModListType } from './types';

export const MOD_DRAG_MIME = 'application/x-rimsort-mod';

export type ModDragPayload = {
	index: number;
	source: ModListType;
};

export function parseModDragPayload(value: string): ModDragPayload | null {
	try {
		const payload: unknown = JSON.parse(value);
		if (typeof payload !== 'object' || payload === null) return null;
		const candidate = payload as Record<string, unknown>;
		if (
			typeof candidate.index !== 'number' ||
			!Number.isInteger(candidate.index) ||
			(candidate.source !== 'active' && candidate.source !== 'inactive')
		) {
			return null;
		}
		return { index: candidate.index, source: candidate.source };
	} catch {
		return null;
	}
}
