import { type DragEvent as ReactDragEvent, Fragment } from 'react';
import { cn } from 'cn';
import {
	BookOpen,
	CircleAlert,
	Crown,
	Dna,
	Download,
	Eye,
	EyeOff,
	Gamepad2,
	Ghost,
	type LucideIcon,
	Rocket,
	TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
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
	filterWarnings: boolean;
	filterErrors: boolean;
	emptyMessage: string;
	modDetailsByPackageId: ReadonlyMap<string, InstalledMod>;
	outdatedWorkshopModsByPackageId: ReadonlyMap<string, OutdatedWorkshopMod>;
	activeDiagnosticsByPackageId: ReadonlyMap<string, ModHighlightState>;
	isLoading: boolean;
	mods: VisibleMod[];
	onDimNonMatchingModsChange: (dim: boolean) => void;
	onFilterWarningsChange: (filter: boolean) => void;
	onFilterErrorsChange: (filter: boolean) => void;
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
		filterWarnings,
		filterErrors,
		emptyMessage,
		modDetailsByPackageId,
		activeDiagnosticsByPackageId,
		outdatedWorkshopModsByPackageId,
		isLoading,
		mods,
		onDimNonMatchingModsChange,
		onFilterWarningsChange,
		onFilterErrorsChange,
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
				<div className='flex min-w-0 items-center gap-2'>
					<Input
						aria-label={`Search ${title.toLowerCase()}`}
						className='min-w-0 flex-1'
						onChange={(event) =>
							onSearchChange(event.currentTarget.value)}
						placeholder='Search names or package IDs'
						value={searchValue}
					/>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label={`Toggle dimming unmatched ${type} mods`}
										aria-pressed={dimNonMatchingMods}
										onClick={() =>
											onDimNonMatchingModsChange(
												!dimNonMatchingMods,
											)}
										size='icon-sm'
										type='button'
										variant='ghost'
									/>
								}
							>
								{dimNonMatchingMods
									? (
										<Eye
											aria-hidden='true'
											data-icon='inline-start'
										/>
									)
									: (
										<EyeOff
											aria-hidden='true'
											data-icon='inline-start'
										/>
									)}
							</TooltipTrigger>
							<TooltipContent>
								{dimNonMatchingMods
									? 'Show unmatched mods at full brightness'
									: 'Dim unmatched mods'}
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label={`Toggle warning filter for ${type} mods`}
										aria-pressed={filterWarnings}
										onClick={() =>
											onFilterWarningsChange(
												!filterWarnings,
											)}
										size='icon-sm'
										type='button'
										variant='ghost'
									/>
								}
							>
								<TriangleAlert
									aria-hidden='true'
									data-icon='inline-start'
								/>
							</TooltipTrigger>
							<TooltipContent>
								{filterWarnings
									? 'Stop filtering by warnings'
									: 'Filter to mods with warnings'}
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label={`Toggle error filter for ${type} mods`}
										aria-pressed={filterErrors}
										onClick={() =>
											onFilterErrorsChange(!filterErrors)}
										size='icon-sm'
										type='button'
										variant='ghost'
									/>
								}
							>
								<CircleAlert
									aria-hidden='true'
									data-icon='inline-start'
								/>
							</TooltipTrigger>
							<TooltipContent>
								{filterErrors
									? 'Stop filtering by errors'
									: 'Filter to mods with errors'}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
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
									errorDetails &&
									`Errors: ${errorDetails}`,
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
												diagnostics?.errors
													.length &&
													'border-l-2 border-destructive',
												!diagnostics?.errors
													.length &&
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
													!isMatch &&
														'opacity-50',
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
													<TooltipProvider>
														<span className='ml-auto flex shrink-0 items-center gap-1'>
															{errorDetails && (
																<Tooltip>
																	<TooltipTrigger
																		render={
																			<span className='shrink-0' />
																		}
																	>
																		<CircleAlert
																			aria-hidden='true'
																			className='shrink-0 text-destructive'
																			focusable='false'
																		/>
																	</TooltipTrigger>
																	<TooltipContent>
																		{errorDetails}
																	</TooltipContent>
																</Tooltip>
															)}
															{warningDetails && (
																<Tooltip>
																	<TooltipTrigger
																		render={
																			<span className='shrink-0' />
																		}
																	>
																		<TriangleAlert
																			aria-hidden='true'
																			className='shrink-0 text-muted-foreground'
																			focusable='false'
																		/>
																	</TooltipTrigger>
																	<TooltipContent>
																		{warningDetails}
																	</TooltipContent>
																</Tooltip>
															)}
															{updateDetails && (
																<Tooltip>
																	<TooltipTrigger
																		render={
																			<span className='shrink-0' />
																		}
																	>
																		<Download
																			aria-hidden='true'
																			className='shrink-0 text-muted-foreground'
																			focusable='false'
																		/>
																	</TooltipTrigger>
																	<TooltipContent>
																		{updateDetails}
																	</TooltipContent>
																</Tooltip>
															)}
														</span>
													</TooltipProvider>
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
