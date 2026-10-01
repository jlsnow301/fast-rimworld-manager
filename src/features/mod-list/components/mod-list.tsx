import { type DragEvent as ReactDragEvent, Fragment } from 'react';
import { cn } from 'cn';
import {
	BookOpen,
	CircleAlert,
	Crown,
	Dna,
	Download,
	Gamepad2,
	Ghost,
	type LucideIcon,
	Rocket,
	TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MOD_DRAG_MIME, parseModDragPayload } from '@/utils/mod_drag';
import { normalizedPackageId } from '@/utils/mods';
import type {
	InstalledMod,
	ModHighlightState,
	ModListType,
	OutdatedWorkshopMod,
	VisibleMod,
} from '@/utils/types';

const LOADING_SKELETON_ROWS = [0, 1, 2, 3];

const OFFICIAL_CONTENT_ICONS: Record<string, LucideIcon> = {
	'ludeon.rimworld': Gamepad2,
	'ludeon.rimworld.royalty': Crown,
	'ludeon.rimworld.ideology': BookOpen,
	'ludeon.rimworld.biotech': Dna,
	'ludeon.rimworld.anomaly': Ghost,
	'ludeon.rimworld.odyssey': Rocket,
};

export type ModListProps = {
	count: number;
	dimNonMatchingMods: boolean;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
	outdatedWorkshopModsByPackageId: ReadonlyMap<string, OutdatedWorkshopMod>;
	activeDiagnosticsByPackageId: ReadonlyMap<string, ModHighlightState>;
	isLoading: boolean;
	mods: VisibleMod[];
	onDimNonMatchingModsChange: (dim: boolean) => void;
	onSearchChange: (search: string) => void;
	onSelectMod: (packageId: string) => void;
	onDropMod: (
		sourceIndex: number,
		source: ModListType,
		target: ModListType,
	) => void;
	searchValue: string;
	title: string;
	type: ModListType;
};

export function ModList(props: ModListProps) {
	const {
		count,
		dimNonMatchingMods,
		emptyMessage,
		modDetailsByPackageId,
		activeDiagnosticsByPackageId,
		outdatedWorkshopModsByPackageId,
		isLoading,
		mods,
		onDimNonMatchingModsChange,
		onSearchChange,
		onSelectMod,
		onDropMod,
		searchValue,
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
		<Card className='flex min-h-0 min-w-0 flex-col' size='sm'>
			<CardHeader className='gap-3'>
				<div className='flex items-center justify-between gap-2'>
					<CardTitle>{title}</CardTitle>
					<Badge variant='outline'>{count}</Badge>
				</div>
				<Input
					aria-label={`Search ${title.toLowerCase()}`}
					onChange={(event) =>
						onSearchChange(event.currentTarget.value)}
					placeholder='Search names or package IDs'
					value={searchValue}
				/>
				<label className='flex items-center gap-2 text-sm'>
					<Checkbox
						aria-label={`Dim non-matching ${title.toLowerCase()}`}
						checked={dimNonMatchingMods}
						onCheckedChange={(checked) =>
							onDimNonMatchingModsChange(checked === true)}
					/>
					<span>Dim non-matching mods</span>
				</label>
			</CardHeader>
			<CardContent className='flex min-h-0 flex-1 flex-col'>
				<div
					className='flex min-h-0 flex-1 flex-col overflow-y-auto border'
					onDragOver={(event) => {
						event.preventDefault();
						event.dataTransfer.dropEffect = 'move';
					}}
					onDrop={handleDrop}
				>
					{isLoading
						? (
							<div
								aria-hidden='true'
								className='flex flex-col gap-4 p-3'
							>
								{LOADING_SKELETON_ROWS.map((row) => (
									<div
										className='flex flex-col gap-2'
										key={row}
									>
										<Skeleton className='h-4 w-3/4' />
										<Skeleton className='h-4 w-1/2' />
									</div>
								))}
							</div>
						)
						: mods.length === 0
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
						: mods.map(
							({ packageId, index, isMatch }, modIndex) => {
								const normalizedId = normalizedPackageId(
									packageId,
								);
								const mod = modDetailsByPackageId.get(
									normalizedId,
								);
								const OfficialContentIcon =
									OFFICIAL_CONTENT_ICONS[normalizedId];
								const diagnostics = type === 'active'
									? activeDiagnosticsByPackageId.get(
										normalizedId,
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
										normalizedId,
									);
								const updateDetails = outdatedWorkshopMod
									? `Steam update available. Latest Workshop update: ${
										new Date(
											outdatedWorkshopMod
												.steamTimeUpdated *
												1000,
										)
											.toLocaleString()
									}.`
									: undefined;
								const accessibleIssues = [
									errorDetails && `Errors: ${errorDetails}`,
									warningDetails &&
									`Warnings: ${warningDetails}`,
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
													diagnostics?.warnings
														.length &&
													'border-l-2 border-muted-foreground',
											)}
											draggable={canDrag}
											onClick={() =>
												onSelectMod(packageId)}
											onDragStart={(event) => {
												event.dataTransfer
													.effectAllowed = 'move';
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
											<span
												className={cn(
													'flex w-full min-w-0 flex-1 items-center gap-2',
													!isMatch && 'opacity-50',
												)}
											>
												{OfficialContentIcon && (
													<OfficialContentIcon
														aria-hidden='true'
														data-icon='inline-start'
														className='mt-0.5 shrink-0 text-muted-foreground'
														focusable='false'
													/>
												)}
												<span className='min-w-0 flex-1 truncate'>
													{mod?.name ?? packageId}
												</span>
												{(errorDetails ||
													warningDetails ||
													updateDetails) && (
													<span className='ml-auto flex shrink-0 items-center gap-1'>
														{errorDetails && (
															<span
																className='shrink-0'
																title={errorDetails}
															>
																<CircleAlert
																	aria-hidden='true'
																	className='shrink-0 text-destructive'
																	focusable='false'
																/>
															</span>
														)}
														{warningDetails && (
															<span
																className='shrink-0'
																title={warningDetails}
															>
																<TriangleAlert
																	aria-hidden='true'
																	className='shrink-0 text-muted-foreground'
																	focusable='false'
																/>
															</span>
														)}
														{updateDetails && (
															<span
																className='shrink-0'
																title={updateDetails}
															>
																<Download
																	aria-hidden='true'
																	className='shrink-0 text-muted-foreground'
																	focusable='false'
																/>
															</span>
														)}
													</span>
												)}
											</span>
										</Button>
										{modIndex < mods.length - 1 && (
											<Separator />
										)}
									</Fragment>
								);
							},
						)}
				</div>
			</CardContent>
		</Card>
	);
}
