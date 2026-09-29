import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from '@/components/ui/field';
import { useAppContext } from '../../../context/app-context';
import { isTestModeAtom, workshopUpdateResultAtom } from '../atoms';
import {
	getSelectedWorkshopMods,
	toggleWorkshopUpdateSelection,
} from '../../../utils/workshop_update_selection';

type WorkshopUpdateDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedIds: string[];
	onSelectionChange: (selectedIds: string[]) => void;
};

export function WorkshopUpdateDialog(props: WorkshopUpdateDialogProps) {
	const { open, onOpenChange, selectedIds, onSelectionChange } = props;
	const { updateSelectedOutdatedWorkshopMods } = useAppContext();
	const isTestMode = useAtomValue(isTestModeAtom);
	const workshopUpdateResult = useAtomValue(workshopUpdateResultAtom);
	const [dispatchingUpdates, setDispatchingUpdates] = useState(false);
	const [dispatchMessage, setDispatchMessage] = useState('');
	const outdatedMods = workshopUpdateResult?.outdatedMods ?? [];
	const selectedMods = getSelectedWorkshopMods(outdatedMods, selectedIds);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) setDispatchMessage('');
		onOpenChange(nextOpen);
	}

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
			if (result.openedCount > 0) {
				onOpenChange(false);
			} else {
				setDispatchMessage(
					'Could not send Workshop update requests to Steam. Check that the Steam client is installed and running.',
				);
			}
		} finally {
			setDispatchingUpdates(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						Update selected {selectedMods.length} of{' '}
						{outdatedMods.length} outdated Workshop mods?
					</DialogTitle>
					<DialogDescription>
						{isTestMode
							? 'Test mode preview only. No Steam requests will be sent.'
							: 'The app will send update requests only for the selected mods to the Steam client. Steam must be installed, running, and signed in to download them.'}
					</DialogDescription>
				</DialogHeader>
				<FieldSet>
					<FieldLegend variant='label'>
						Outdated Workshop mods
					</FieldLegend>
					<FieldGroup className='max-h-60 gap-3 overflow-y-auto'>
						{outdatedMods.map((mod) => {
							const id = `workshop-update-${mod.publishedFileId}`;
							return (
								<Field
									data-disabled={dispatchingUpdates}
									key={mod.publishedFileId}
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
											<FieldTitle>{mod.name}</FieldTitle>
											<Badge variant='outline'>
												{mod.packageId}
											</Badge>
										</FieldContent>
									</FieldLabel>
								</Field>
							);
						})}
					</FieldGroup>
					{(workshopUpdateResult?.skippedCount ?? 0) > 0 && (
						<FieldDescription>
							{workshopUpdateResult?.skippedCount}{' '}
							Workshop mods could not be compared and will not be
							included.
						</FieldDescription>
					)}
				</FieldSet>
				{dispatchMessage && <FieldError>{dispatchMessage}</FieldError>}
				<DialogFooter>
					<DialogClose
						render={
							<Button
								disabled={dispatchingUpdates}
								variant='outline'
							/>
						}
					>
						Cancel
					</DialogClose>
					<Button
						disabled={dispatchingUpdates || isTestMode ||
							selectedMods.length === 0}
						onClick={handleUpdateSelected}
					>
						{isTestMode
							? 'Steam updates disabled in test mode'
							: dispatchingUpdates
							? 'Sending to Steam…'
							: `Update ${selectedMods.length} selected mod${
								selectedMods.length === 1 ? '' : 's'
							}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
