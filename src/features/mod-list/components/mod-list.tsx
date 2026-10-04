import { Fragment } from 'react';
import { useDroppable } from '@dnd-kit/react';
import { CircleAlert, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { normalizedPackageId } from '@/utils/mods';
import type {
	InstalledMod,
	ModHighlightState,
	ModListType,
	OutdatedWorkshopMod,
	VisibleMod,
} from '@/utils/types';
import { ModListRow } from '@/features/mod-list/components/mod-list-row';

const LOADING_SKELETON_ROWS = [0, 1, 2, 3];

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
		searchValue,
		title,
		type,
	} = props;
	const { ref: dropTargetRef } = useDroppable({
		id: `mod-list-${type}`,
		accept: 'mod',
		data: { target: type },
	});
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
									className='shrink-0 text-yellow-600 dark:text-yellow-400'
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
									className='shrink-0 text-destructive'
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
				<ScrollArea
					ref={dropTargetRef}
					className='min-h-0 flex-1 border'
					data-mod-list-type={type}
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
								const diagnostics = type === 'active'
									? activeDiagnosticsByPackageId.get(
										normalizedId,
									)
									: undefined;
								const outdatedWorkshopMod =
									outdatedWorkshopModsByPackageId.get(
										normalizedId,
									);
								const rowData = {
									packageId,
									index,
									isMatch,
									name: mod?.name ?? packageId,
									diagnostics,
									outdatedWorkshopMod,
								};

								return (
									<Fragment key={`${packageId}-${index}`}>
										<ModListRow
											data={rowData}
											onSelectMod={onSelectMod}
											type={type}
										/>
										{modIndex < mods.length - 1 && (
											<Separator />
										)}
									</Fragment>
								);
							},
						)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
