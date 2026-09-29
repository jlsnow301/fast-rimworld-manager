import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
	activeModDiagnosticsAtom,
	activeModsAtom,
	activeSearchAtom,
	checkingWorkshopUpdatesAtom,
	gameVersionAtom,
	hasModListAtom,
	hasWorkshopModsAtom,
	inactiveModsAtom,
	inactiveSearchAtom,
	isTestModeAtom,
	modDetailsByPackageIdAtom,
	outdatedWorkshopModsByPackageIdAtom,
	statusAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
	workshopUpdateStatusAtom,
} from '../../state/app-atoms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppContext } from '../../context/app-context';
import { allWorkshopUpdateIds } from '../../utils/workshop_update_selection';
import { ModPreviewFeature } from '../mod-preview/mod-preview-feature';
import { ModListPanel } from './components/mod-list-panel';
import { WorkshopUpdateDialog } from './components/workshop-update-dialog';

export function ModListFeature() {
	const { moveMod, sortMods, selectMod, checkForModUpdates } =
		useAppContext();
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
	const hasWorkshopMods = useAtomValue(hasWorkshopModsAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const checkingWorkshopUpdates = useAtomValue(checkingWorkshopUpdatesAtom);
	const outdatedWorkshopModsByPackageId = useAtomValue(
		outdatedWorkshopModsByPackageIdAtom,
	);
	const workshopUpdateStatus = useAtomValue(workshopUpdateStatusAtom);
	const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
	const [selectedUpdateIds, setSelectedUpdateIds] = useState<string[]>([]);

	async function handleCheckForUpdates() {
		const result = await checkForModUpdates();
		const outdatedMods = result?.outdatedMods ?? [];
		setSelectedUpdateIds(allWorkshopUpdateIds(outdatedMods));
		setUpdateDialogOpen(outdatedMods.length > 0);
	}

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
						{activeMods.length} active · {inactiveMods.length}{' '}
						inactive
					</Badge>
					<Button
						aria-busy={checkingWorkshopUpdates}
						disabled={checkingWorkshopUpdates ||
							(!isTestMode && !hasWorkshopMods)}
						onClick={handleCheckForUpdates}
						size='sm'
						variant='outline'
					>
						{checkingWorkshopUpdates
							? 'Checking Workshop…'
							: isTestMode
							? 'Preview update dialog'
							: 'Check for updates'}
					</Button>
					<Button
						disabled={activeMods.length < 2}
						onClick={sortMods}
						size='sm'
						variant='outline'
					>
						Sort active mods
					</Button>
				</div>
				{workshopUpdateStatus && (
					<Badge
						aria-live='polite'
						role='status'
						variant={workshopUpdateStatus.state === 'updates'
							? 'secondary'
							: 'outline'}
					>
						{workshopUpdateStatus.state === 'checking'
							? (
								<LoaderCircle
									className='animate-spin'
									data-icon='inline-start'
								/>
							)
							: workshopUpdateStatus.state === 'no-updates'
							? <Check data-icon='inline-start' />
							: null}
						{workshopUpdateStatus.message}
					</Badge>
				)}
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
			<div className='grid grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]'>
				<ModPreviewFeature />
				<div className='grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'>
					<ModListPanel
						count={activeMods.length}
						emptyMessage={hasModList
							? 'No active mods.'
							: 'Import a ModsConfig.xml or configure your RimWorld paths.'}
						mods={visibleActiveMods}
						activeDiagnosticsByPackageId={activeModDiagnostics
							.byPackageId}
						outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
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
						activeDiagnosticsByPackageId={activeModDiagnostics
							.byPackageId}
						outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
						modDetailsByPackageId={modDetailsByPackageId}
						onDropMod={moveMod}
						onSelectMod={selectMod}
						onSearch={setInactiveSearch}
						search={inactiveSearch}
						title='Inactive mods'
						type='inactive'
					/>
				</div>
			</div>
			<p
				aria-live='polite'
				className='mt-3 text-sm text-muted-foreground'
			>
				{status}
			</p>
			<WorkshopUpdateDialog
				open={updateDialogOpen}
				onOpenChange={setUpdateDialogOpen}
				selectedIds={selectedUpdateIds}
				onSelectionChange={setSelectedUpdateIds}
			/>
		</section>
	);
}
