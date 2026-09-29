import { type DragEvent as ReactDragEvent, Fragment } from 'react';
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
import { MOD_DRAG_MIME, parseModDragPayload } from '../../../utils/mod_drag';
import { normalizedPackageId } from '../../../utils/mods';
import type {
	InstalledMod,
	ModHighlightState,
	ModListType,
	OutdatedWorkshopMod,
	VisibleMod,
} from '../../../utils/types';
export type ModListPanelProps = {
	count: number;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
	outdatedWorkshopModsByPackageId: ReadonlyMap<string, OutdatedWorkshopMod>;
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

export function ModListPanel(props: ModListPanelProps) {
	const {
		count,
		emptyMessage,
		modDetailsByPackageId,
		activeDiagnosticsByPackageId,
		outdatedWorkshopModsByPackageId,
		mods,
		onSelectMod,
		onDropMod,
		onSearch,
		search,
		title,
		type,
	} = props;
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
					className='flex min-h-72 max-h-[calc(100dvh-22rem)] flex-col overflow-y-auto border'
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
									<EmptyTitle>
										{count > 0 ? 'No matches' : title}
									</EmptyTitle>
									<EmptyDescription>
										{emptyMessage}
									</EmptyDescription>
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
								.map((issue) =>
									`${issue.title}: ${
										issue.details.join(', ')
									}`
								)
								.join('. ');
							const warningDetails = diagnostics?.warnings
								.map((issue) =>
									`${issue.title}: ${
										issue.details.join(', ')
									}`
								)
								.join('. ');
							const outdatedWorkshopMod =
								outdatedWorkshopModsByPackageId.get(
									normalizedPackageId(packageId),
								);
							const updateDetails = outdatedWorkshopMod
								? `Steam update available. Latest Workshop update: ${
									new Date(
										outdatedWorkshopMod.steamTimeUpdated *
											1000,
									)
										.toLocaleString()
								}.`
								: undefined;
							const accessibleIssues = [
								errorDetails && `Errors: ${errorDetails}`,
								warningDetails && `Warnings: ${warningDetails}`,
								updateDetails,
							].filter(Boolean).join('. ');

							const canDrag = type !== 'active' ||
								normalizedPackageId(packageId) !==
									'ludeon.rimworld';
							return (
								<Fragment key={`${packageId}-${index}`}>
									<Button
										aria-label={`Show details for ${
											mod?.name ?? packageId
										}${
											accessibleIssues
												? `. ${accessibleIssues}`
												: ''
										}`}
										className={cn(
											'h-auto min-h-12 w-full justify-start rounded-none px-3 py-2 text-left normal-case tracking-normal',
											canDrag
												? 'cursor-grab active:cursor-grabbing'
												: 'cursor-default',
											diagnostics?.errors.length &&
												'border-l-2 border-destructive',
											!diagnostics?.errors.length &&
												diagnostics?.warnings.length &&
												'border-l-2 border-muted-foreground',
										)}
										draggable={canDrag}
										onClick={() => onSelectMod(packageId)}
										onDragStart={(event) => {
											event.dataTransfer.effectAllowed =
												'move';
											event.dataTransfer.setData(
												MOD_DRAG_MIME,
												JSON.stringify({
													index,
													source: type,
												}),
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
													<Badge variant='secondary'>
														{mod.packageId}
													</Badge>
													<Badge variant='outline'>
														{mod.source}
													</Badge>
												</span>
											)}
											{diagnostics?.errors.map((
												issue,
											) => (
												<Badge
													key={issue.code}
													title={issue.details.join(
														', ',
													)}
													variant='destructive'
												>
													{issue.title}
												</Badge>
											))}
											{diagnostics?.warnings.map((
												issue,
											) => (
												<Badge
													key={issue.code}
													title={issue.details.join(
														', ',
													)}
													variant='outline'
												>
													{issue.title}
												</Badge>
											))}
											{outdatedWorkshopMod && (
												<Badge
													title={`Installed update: ${
														new Date(
															outdatedWorkshopMod
																.installedTimeUpdated *
																1000,
														).toLocaleString()
													}`}
													variant='secondary'
												>
													Update available
												</Badge>
											)}
										</span>
									</Button>
									{modIndex < mods.length - 1 && (
										<Separator />
									)}
								</Fragment>
							);
						})}
				</div>
			</CardContent>
		</Card>
	);
}
