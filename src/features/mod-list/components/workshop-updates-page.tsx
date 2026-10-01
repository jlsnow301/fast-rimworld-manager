import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { ArrowLeft, LoaderCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Field,
	FieldContent,
	FieldLabel,
	FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
	isTestModeAtom,
	workshopUpdateResultAtom,
} from '@/features/mod-list/atoms';
import { useAppContext } from '@/context/app-context';
import {
	filterWorkshopUpdatesBySearch,
	getSelectedWorkshopMods,
	toggleWorkshopUpdateSelection,
} from '@/utils/workshop_update_selection';

type WorkshopUpdatesPageProps = {
	selectedIds: string[];
	onSelectionChange: (selectedIds: string[]) => void;
	onBack: () => void;
};

export function WorkshopUpdatesPage(props: WorkshopUpdatesPageProps) {
	const { selectedIds, onSelectionChange, onBack } = props;
	const { updateSelectedOutdatedWorkshopMods } = useAppContext();
	const isTestMode = useAtomValue(isTestModeAtom);
	const workshopUpdateResult = useAtomValue(workshopUpdateResultAtom);
	const [search, setSearch] = useState('');
	const [dispatchingUpdates, setDispatchingUpdates] = useState(false);
	const [dispatchMessage, setDispatchMessage] = useState('');
	const outdatedMods = workshopUpdateResult?.outdatedMods ?? [];
	const visibleMods = filterWorkshopUpdatesBySearch(outdatedMods, search);
	const selectedMods = getSelectedWorkshopMods(outdatedMods, selectedIds);

	async function handleUpdateSelected() {
		if (isTestMode) {
			setDispatchMessage(
				'Test mode preview only. Steam update requests are disabled.',
			);
			return;
		}
		if (selectedMods.length === 0) return;

		setDispatchingUpdates(true);
		setDispatchMessage('');
		try {
			const result = await updateSelectedOutdatedWorkshopMods(
				selectedMods,
			);
			if (result.openedCount > 0 && result.failedCount === 0) {
				onBack();
			} else {
				setDispatchMessage(
					`Could not send all selected Workshop update requests to Steam. Sent ${result.openedCount} of ${selectedMods.length}. Check that the Steam client is installed and running.`,
				);
			}
		} catch (error) {
			setDispatchMessage(
				error instanceof Error
					? error.message
					: 'Could not send Workshop update requests to Steam.',
			);
		} finally {
			setDispatchingUpdates(false);
		}
	}

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-4'>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div className='flex items-start gap-3'>
					<Button
						disabled={dispatchingUpdates}
						onClick={onBack}
						size='sm'
						variant='outline'
					>
						<ArrowLeft data-icon='inline-start' />
						Back to mod list
					</Button>
					<div>
						<h2 className='text-lg font-semibold tracking-wide uppercase'>
							Workshop updates
						</h2>
						<p className='text-sm text-muted-foreground'>
							Select which outdated Workshop mods to send to
							Steam.
						</p>
					</div>
				</div>
				<Badge variant='secondary'>
					{selectedMods.length} selected of {outdatedMods.length}
				</Badge>
			</div>
			<div className='flex flex-wrap items-end justify-between gap-3'>
				<label className='flex min-w-64 flex-1 items-center gap-2 rounded-md border px-3'>
					<Search
						aria-hidden='true'
						className='size-4 text-muted-foreground'
					/>
					<Input
						aria-label='Search Workshop updates'
						className='border-0 focus-visible:border-0'
						onChange={(event) => setSearch(event.target.value)}
						placeholder='Search by mod name or package ID'
						value={search}
					/>
				</label>
				<p className='text-sm text-muted-foreground' aria-live='polite'>
					Showing {visibleMods.length} of {outdatedMods.length}{' '}
					outdated mods · {workshopUpdateResult?.checkedCount ?? 0}
					{' '}
					checked
				</p>
			</div>
			{(workshopUpdateResult?.skippedCount ?? 0) > 0 && (
				<p className='text-sm text-muted-foreground' role='status'>
					{workshopUpdateResult?.skippedCount}{' '}
					Workshop mods could not be checked and are not included.
				</p>
			)}
			<div
				role='region'
				aria-label='Outdated Workshop mods'
				className='min-h-0 flex-1 overflow-y-auto rounded-md border'
				data-testid='workshop-update-list'
			>
				{visibleMods.length > 0
					? (
						<div className='divide-y'>
							{visibleMods.map((mod) => {
								const id =
									`workshop-update-${mod.publishedFileId}`;
								return (
									<Field
										data-disabled={dispatchingUpdates}
										key={mod.publishedFileId}
										className='items-center px-4 py-3'
										orientation='horizontal'
									>
										<Checkbox
											checked={selectedIds.includes(
												mod.publishedFileId,
											)}
											disabled={dispatchingUpdates}
											id={id}
											onCheckedChange={(checked) => {
												onSelectionChange(
													toggleWorkshopUpdateSelection(
														selectedIds,
														mod.publishedFileId,
														checked === true,
													),
												);
											}}
										/>
										<FieldLabel
											className='min-w-0 flex-1 font-normal'
											htmlFor={id}
										>
											<FieldContent>
												<FieldTitle>
													{mod.name}
												</FieldTitle>
												<Badge variant='outline'>
													{mod.packageId}
												</Badge>
											</FieldContent>
										</FieldLabel>
									</Field>
								);
							})}
						</div>
					)
					: (
						<p className='p-6 text-sm text-muted-foreground'>
							No outdated Workshop mods match this search.
						</p>
					)}
			</div>
			{isTestMode && (
				<p className='text-sm text-muted-foreground'>
					Test mode preview only. No Steam requests will be sent.
				</p>
			)}
			{dispatchMessage && (
				<p className='text-sm text-destructive' role='alert'>
					{dispatchMessage}
				</p>
			)}
			<div className='flex shrink-0 justify-end gap-3'>
				<Button
					disabled={dispatchingUpdates}
					onClick={onBack}
					variant='outline'
				>
					Back to mod list
				</Button>
				<Button
					disabled={dispatchingUpdates || isTestMode ||
						selectedMods.length === 0}
					onClick={handleUpdateSelected}
				>
					{dispatchingUpdates
						? (
							<>
								<LoaderCircle
									className='animate-spin'
									data-icon='inline-start'
								/>
								Sending to Steam…
							</>
						)
						: isTestMode
						? 'Steam updates disabled in test mode'
						: `Update ${selectedMods.length} selected mod${
							selectedMods.length === 1 ? '' : 's'
						}`}
				</Button>
			</div>
		</div>
	);
}
