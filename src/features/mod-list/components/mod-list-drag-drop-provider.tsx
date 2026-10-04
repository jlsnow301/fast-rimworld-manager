import type { ReactNode } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import type { ModListDragData, ModListDropData } from '@/utils/mod_lists';
import type { ModListType } from '@/utils/types';

type ModListDropHandler = (
	sourceIndex: number,
	source: ModListType,
	target: ModListType,
) => void;

type ModListDragDropProviderProps = {
	children: ReactNode;
	onDropMod: ModListDropHandler;
};

export function ModListDragDropProvider(
	props: ModListDragDropProviderProps,
) {
	const { children, onDropMod } = props;

	return (
		<DragDropProvider
			onDragEnd={(event) => {
				if (event.canceled) return;
				const source = event.operation.source?.data as
					| ModListDragData
					| undefined;
				const target = event.operation.target?.data as
					| ModListDropData
					| undefined;
				if (!source || !target || source.source === target.target) {
					return;
				}
				onDropMod(source.sourceIndex, source.source, target.target);
			}}
		>
			{children}
		</DragDropProvider>
	);
}
