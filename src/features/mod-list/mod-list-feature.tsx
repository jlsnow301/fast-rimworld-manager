import { type DragEvent as ReactDragEvent, Fragment } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
	activeModDiagnosticsAtom,
	activeModsAtom,
	activeSearchAtom,
	gameVersionAtom,
	hasModListAtom,
	inactiveModsAtom,
	inactiveSearchAtom,
	modDetailsByPackageIdAtom,
	statusAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
} from '../../state/app-atoms';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '../../context/app-context';
import { MOD_DRAG_MIME, parseModDragPayload } from '../../utils/mod_drag';
import { normalizedPackageId } from '../../utils/mods';
import type {
	InstalledMod,
	ModHighlightState,
	ModListType,
	VisibleMod,
} from '../../utils/types';
import { ModPreviewFeature } from '../mod-preview/mod-preview-feature';

export function ModListFeature() {
	const { moveMod, sortMods, selectMod } = useAppContext();
	const activeMods = useAtomValue(activeModsAtom);
	const activeSearch = useAtomValue(activeSearchAtom);
	const inactiveMods = useAtomValue(inactiveModsAtom);
	const inactiveSearch = useAtomValue(inactiveSearchAtom);
	const modDetailsByPackageId = useAtomValue(modDetailsByPackageIdAtom);
	const activeModDiagnostics = useAtomValue(activeModDiagnosticsAtom);
	const setActiveSearch = useSetAtom(activeSearchAtom);
	const setInactiveSearch = useSetAtom(inactiveSearchAtom);
	const status = useAtomValue(statusAtom);
	const visibleActiveMods = useAtomValue(visibleActiveModsAtom);
	const visibleInactiveMods = useAtomValue(visibleInactiveModsAtom);
	const gameVersion = useAtomValue(gameVersionAtom);
	const hasModList = useAtomValue(hasModListAtom);

	return (
		<section className='mx-auto w-full max-w-7xl p-6'>
			<div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
				<div>
					<h2 className='text-lg font-semibold tracking-wide uppercase'>
						Mod list
					</h2>
					<p className='text-sm text-muted-foreground'>
						Game version {gameVersion}
					</p>
				</div>
				<div className='flex items-center gap-3'>
					<Badge variant='secondary'>
						{activeMods.length} active · {inactiveMods.length} inactive
					</Badge>
					<Button
						disabled={activeMods.length < 2}
						onClick={sortMods}
						size='sm'
						variant='outline'
					>
						Sort active mods
					</Button>
				</div>
			</div>
			<p className='mb-3 text-sm text-muted-foreground'>
				Drag mods between the lists to change activation.
			</p>
			<p
				aria-live='polite'
				className='mb-3 flex flex-wrap items-center gap-2 text-sm'
				role={activeModDiagnostics.errorCount ? 'alert' : 'status'}
			>
				<span>Active mod list checks:</span>
				{!hasModList
					? <Badge variant='secondary'>No active list loaded</Badge>
					: activeModDiagnostics.errorCount > 0
					? (
						<Badge variant='destructive'>
							{activeModDiagnostics.errorCount} mods with errors
						</Badge>
					)
					: <Badge variant='secondary'>No errors</Badge>}
				{activeModDiagnostics.warningCount > 0 && (
					<Badge variant='outline'>
						{activeModDiagnostics.warningCount} mods with warnings
					</Badge>
				)}
				{hasModList &&
					(activeModDiagnostics.errorCount > 0 ||
						activeModDiagnostics.warningCount > 0) &&
					(
						<span className='text-muted-foreground'>
							Select a highlighted mod for details.
						</span>
					)}
			</p>
			<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
				<ModListPanel
					count={activeMods.length}
					emptyMessage={hasModList
						? 'No active mods.'
						: 'Import a ModsConfig.xml or configure your RimWorld paths.'}
					mods={visibleActiveMods}
					activeDiagnosticsByPackageId={activeModDiagnostics.byPackageId}
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
					activeDiagnosticsByPackageId={activeModDiagnostics.byPackageId}
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
			<p aria-live='polite' className='mt-3 text-sm text-muted-foreground'>
				{status}
			</p>
		</section>
	);
}

type ModListPanelProps = {
	count: number;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
	activeDiagnosticsByPackageId: ReadonlyMap<string, ModHighlightState>;
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
	activeDiagnosticsByPackageId,
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
		<Card className='min-w-0' size='sm'>
			<CardHeader className='flex flex-row items-center justify-between'>
				<CardTitle>{title}</CardTitle>
				<CardAction>
					<Badge variant='outline'>{count}</Badge>
				</CardAction>
			</CardHeader>
			<CardContent className='flex min-h-0 flex-col gap-3'>
				<Input
					aria-label={`Search ${title.toLowerCase()}`}
					onChange={(event) => onSearch(event.currentTarget.value)}
					placeholder='Search names or package IDs'
					value={search}
				/>
				<div
					className='flex min-h-72 max-h-[calc(100vh-22rem)] flex-col overflow-y-auto border'
					onDragOver={(event) => {
						event.preventDefault();
						event.dataTransfer.dropEffect = 'move';
					}}
					onDrop={handleDrop}
				>
					{mods.length === 0
						? (
							<Empty className='flex-1 p-6'>
								<EmptyHeader>
									<EmptyTitle>{count > 0 ? 'No matches' : title}</EmptyTitle>
									<EmptyDescription>{emptyMessage}</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)
						: mods.map(({ packageId, index }, modIndex) => {
							const mod = modDetailsByPackageId.get(
								normalizedPackageId(packageId),
							);
							const diagnostics = type === 'active'
								? activeDiagnosticsByPackageId.get(
									normalizedPackageId(packageId),
								)
								: undefined;
							const errorDetails = diagnostics?.errors
								.map((issue) => `${issue.title}: ${issue.details.join(', ')}`)
								.join('. ');
							const warningDetails = diagnostics?.warnings
								.map((issue) => `${issue.title}: ${issue.details.join(', ')}`)
								.join('. ');
							const accessibleIssues = [
								errorDetails && `Errors: ${errorDetails}`,
								warningDetails && `Warnings: ${warningDetails}`,
							].filter(Boolean).join('. ');

							return (
								<Fragment key={`${packageId}-${index}`}>
									<Button
										aria-label={`Show details for ${mod?.name ?? packageId}${
											accessibleIssues ? `. ${accessibleIssues}` : ''
										}`}
										className={cn(
											'h-auto min-h-12 w-full justify-start rounded-none px-3 py-2 text-left normal-case tracking-normal cursor-grab active:cursor-grabbing',
											diagnostics?.errors.length &&
												'border-l-2 border-destructive',
											!diagnostics?.errors.length &&
												diagnostics?.warnings.length &&
												'border-l-2 border-muted-foreground',
										)}
										draggable
										onClick={() => onSelectMod(packageId)}
										onDragStart={(event) => {
											event.dataTransfer.effectAllowed = 'move';
											event.dataTransfer.setData(
												MOD_DRAG_MIME,
												JSON.stringify({ index, source: type }),
											);
										}}
										variant='ghost'
									>
										<span className='flex min-w-0 flex-col items-start gap-1'>
											<span className='break-words'>
												{mod?.name ?? packageId}
											</span>
											{mod && (
												<span className='flex flex-wrap gap-2'>
													<Badge variant='secondary'>{mod.packageId}</Badge>
													<Badge variant='outline'>{mod.source}</Badge>
												</span>
											)}
											{diagnostics?.errors.map((issue) => (
												<Badge
													key={issue.code}
													title={issue.details.join(', ')}
													variant='destructive'
												>
													{issue.title}
												</Badge>
											))}
											{diagnostics?.warnings.map((issue) => (
												<Badge
													key={issue.code}
													title={issue.details.join(', ')}
													variant='outline'
												>
													{issue.title}
												</Badge>
											))}
										</span>
									</Button>
									{modIndex < mods.length - 1 && <Separator />}
								</Fragment>
							);
						})}
				</div>
			</CardContent>
		</Card>
	);
}
