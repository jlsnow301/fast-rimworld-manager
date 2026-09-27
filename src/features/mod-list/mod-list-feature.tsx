import type { DragEvent as ReactDragEvent } from 'react';
import { useAppContext } from '../../context/app-context';
import { MOD_DRAG_MIME, parseModDragPayload } from '../../utils/mod_drag';
import { normalizedPackageId } from '../../utils/mods';
import type { InstalledMod, ModListType, VisibleMod } from '../../utils/types';
import { ModPreviewFeature } from '../mod-preview/mod-preview-feature';

export function ModListFeature() {
	const {
		activeMods,
		activeSearch,
		inactiveMods,
		inactiveSearch,
		modDetailsByPackageId,
		moveMod,
		selectMod,
		setActiveSearch,
		setInactiveSearch,
		status,
		visibleActiveMods,
		visibleInactiveMods,
		gameVersion,
		hasModList,
	} = useAppContext();

	return (
		<section className='content'>
			<div className='page-heading'>
				<div>
					<h2>Mod list</h2>
					<p>Game version {gameVersion}</p>
				</div>
				<span>
					{activeMods.length} active · {inactiveMods.length} inactive
				</span>
			</div>
			<p className='mod-drag-hint'>
				Drag mods between the lists to change activation.
			</p>
			<div className='mod-columns'>
				<ModListPanel
					count={activeMods.length}
					emptyMessage={hasModList
						? 'No active mods.'
						: 'Import a mod list to see active mods.'}
					mods={visibleActiveMods}
					modDetailsByPackageId={modDetailsByPackageId}
					onDropMod={moveMod}
					onSelectMod={selectMod}
					onSearch={setActiveSearch}
					search={activeSearch}
					title='Active mods'
					type='active'
				/>
				<ModListPanel
					count={inactiveMods.length}
					emptyMessage='No inactive mods found. Configure paths in Settings.'
					mods={visibleInactiveMods}
					modDetailsByPackageId={modDetailsByPackageId}
					onDropMod={moveMod}
					onSelectMod={selectMod}
					onSearch={setInactiveSearch}
					search={inactiveSearch}
					title='Inactive mods'
					type='inactive'
				/>
			</div>
			<ModPreviewFeature />
			<p aria-live='polite' className='status-message'>{status}</p>
		</section>
	);
}

type ModListPanelProps = {
	count: number;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
	mods: VisibleMod[];
	onSelectMod: (packageId: string) => void;
	onDropMod: (
		sourceIndex: number,
		source: ModListType,
		target: ModListType,
	) => void;
	onSearch: (query: string) => void;
	search: string;
	title: string;
	type: ModListType;
};

function ModListPanel({
	count,
	emptyMessage,
	modDetailsByPackageId,
	mods,
	onSelectMod,
	onDropMod,
	onSearch,
	search,
	title,
	type,
}: ModListPanelProps) {
	function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
		event.preventDefault();
		const payload = parseModDragPayload(
			event.dataTransfer.getData(MOD_DRAG_MIME),
		);
		if (payload) onDropMod(payload.index, payload.source, type);
	}

	return (
		<section className='mod-panel'>
			<div className='panel-heading'>
				<h3>{title}</h3>
				<span>{count}</span>
			</div>
			<input
				aria-label={`Search ${title.toLowerCase()}`}
				onChange={(event) => onSearch(event.currentTarget.value)}
				placeholder='Search package IDs'
				value={search}
			/>
			<div
				className='mod-list'
				onDragOver={(event) => {
					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
				}}
				onDrop={handleDrop}
			>
				{mods.length === 0
					? (
						<p className='empty-message'>
							{count > 0 ? 'No matches.' : emptyMessage}
						</p>
					)
					: mods.map(({ packageId, index }) => {
						const mod = modDetailsByPackageId.get(
							normalizedPackageId(packageId),
						);
						return (
							<div
								className='mod-row'
								aria-label={`Show details for ${mod?.name ?? packageId}`}
								draggable
								key={`${packageId}-${index}`}
								role='button'
								tabIndex={0}
								onClick={() => onSelectMod(packageId)}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										onSelectMod(packageId);
									}
								}}
								onDragStart={(event) => {
									event.dataTransfer.effectAllowed = 'move';
									event.dataTransfer.setData(
										MOD_DRAG_MIME,
										JSON.stringify({ index, source: type }),
									);
								}}
							>
								<div className='mod-labels'>
									<span className='mod-name'>{mod?.name ?? packageId}</span>
									{mod && (
										<span className='package-id'>
											{mod.packageId} · {mod.source}
										</span>
									)}
								</div>
							</div>
						);
					})}
			</div>
		</section>
	);
}
