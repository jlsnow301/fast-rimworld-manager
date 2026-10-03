import type { ModListType } from '@/utils/types';

export type ModDragPayload = {
	index: number;
	source: ModListType;
};

type ModPointerDrag = ModDragPayload & {
	pointerId: number;
	startX: number;
	startY: number;
	isDragging: boolean;
};

let activeDrag: ModPointerDrag | null = null;
let suppressRowClick = false;
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined;

export function startModPointerDrag(
	payload: ModDragPayload,
	pointerId: number,
	clientX: number,
	clientY: number,
) {
	activeDrag = {
		...payload,
		pointerId,
		startX: clientX,
		startY: clientY,
		isDragging: false,
	};
	suppressRowClick = false;
	clearTimeout(suppressClickTimer);
}

export function updateModPointerDrag(
	pointerId: number,
	clientX: number,
	clientY: number,
) {
	if (!activeDrag || activeDrag.pointerId !== pointerId) return;
	const deltaX = clientX - activeDrag.startX;
	const deltaY = clientY - activeDrag.startY;
	if (deltaX * deltaX + deltaY * deltaY >= 36) {
		activeDrag.isDragging = true;
	}
}

export function finishModPointerDrag(
	pointerId: number,
): ModDragPayload | null {
	if (!activeDrag || activeDrag.pointerId !== pointerId) return null;
	const payload = activeDrag.isDragging
		? { index: activeDrag.index, source: activeDrag.source }
		: null;
	activeDrag = null;
	if (payload) {
		suppressRowClick = true;
		clearTimeout(suppressClickTimer);
		suppressClickTimer = setTimeout(() => {
			suppressRowClick = false;
		}, 0);
	}
	return payload;
}

export function cancelModPointerDrag(pointerId: number) {
	if (activeDrag?.pointerId === pointerId) activeDrag = null;
}

export function consumeSuppressedModClick() {
	if (!suppressRowClick) return false;
	suppressRowClick = false;
	clearTimeout(suppressClickTimer);
	return true;
}
