import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
	activeDimNonMatchingModsAtom,
	activeModDiagnosticsAtom,
	activeModsAtom,
	activeModSearchAtom,
	checkingWorkshopUpdatesAtom,
	gameVersionAtom,
	hasModListAtom,
	hasWorkshopModsAtom,
	inactiveDimNonMatchingModsAtom,
	inactiveModsAtom,
	inactiveModSearchAtom,
	isTestModeAtom,
	modDetailsByPackageIdAtom,
	modListLoadStateAtom,
	outdatedWorkshopModsByPackageIdAtom,
	statusAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
	workshopUpdateStatusAtom,
} from '@/features/mod-list/atoms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/app-context';
import { allWorkshopUpdateIds } from '@/utils/workshop_update_selection';
import { ModPreviewFeature } from '@/features/mod-preview/mod-preview-feature';
import { ModList } from '@/features/mod-list/components/mod-list';
import { WorkshopUpdatesPage } from '@/features/mod-list/components/workshop-updates-page';

export function ModListFeature() {
	const { moveMod, sortMods, selectMod, checkForModUpdates } =
		useAppContext();
	const activeMods = useAtomValue(activeModsAtom);
	const activeDimNonMatchingMods = useAtomValue(
		activeDimNonMatchingModsAtom,
	);
	const setActiveDimNonMatchingMods = useSetAtom(
		activeDimNonMatchingModsAtom,
	);
	const activeModSearch = useAtomValue(activeModSearchAtom);
	const setActiveModSearch = useSetAtom(activeModSearchAtom);
	const inactiveMods = useAtomValue(inactiveModsAtom);
	const inactiveDimNonMatchingMods = useAtomValue(
		inactiveDimNonMatchingModsAtom,
	);
	const setInactiveDimNonMatchingMods = useSetAtom(
		inactiveDimNonMatchingModsAtom,
	);
	const inactiveModSearch = useAtomValue(inactiveModSearchAtom);
	const setInactiveModSearch = useSetAtom(inactiveModSearchAtom);
	const modDetailsByPackageId = useAtomValue(modDetailsByPackageIdAtom);
	const activeModDiagnostics = useAtomValue(activeModDiagnosticsAtom);
	const status = useAtomValue(statusAtom);
	const modListLoadState = useAtomValue(modListLoadStateAtom);
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
	const [showWorkshopUpdates, setShowWorkshopUpdates] = useState(false);
	const [selectedUpdateIds, setSelectedUpdateIds] = useState<string[]>([]);

	async function handleCheckForUpdates() {
		const result = await checkForModUpdates();
		const outdatedMods = result?.outdatedMods ?? [];
		setSelectedUpdateIds(allWorkshopUpdateIds(outdatedMods));
		setShowWorkshopUpdates(outdatedMods.length > 0);
	}

	return (
		<section
			aria-busy={modListLoadState === 'loading'}
			className='mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col p-6'
		>
			{showWorkshopUpdates
				? (
					<WorkshopUpdatesPage
						selectedIds={selectedUpdateIds}
						onSelectionChange={setSelectedUpdateIds}
						onBack={() => setShowWorkshopUpdates(false)}
					/>
				)
				: (
					<>
						<div className='mb-4 flex flex-wrap items-end justify-between gap-3'>
							<p className='text-sm text-muted-foreground'>
								Game version {gameVersion}
							</p>
							<div className='flex items-center gap-3'>
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
										? 'Preview Workshop updates'
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
									variant={workshopUpdateStatus.state ===
											'updates'
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
										: workshopUpdateStatus.state ===
												'no-updates'
										? <Check data-icon='inline-start' />
										: null}
									{workshopUpdateStatus.message}
								</Badge>
							)}
						</div>
						<div className='grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1'>
							<div className='min-h-0 overflow-y-auto'>
								<ModPreviewFeature />
							</div>
							<ModList
								count={inactiveMods.length}
								dimNonMatchingMods={inactiveDimNonMatchingMods}
								isLoading={modListLoadState === 'loading'}
								emptyMessage='No inactive mods found. Configure paths in Settings.'
								mods={visibleInactiveMods}
								activeDiagnosticsByPackageId={activeModDiagnostics
									.byPackageId}
								outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
								modDetailsByPackageId={modDetailsByPackageId}
								onDimNonMatchingModsChange={setInactiveDimNonMatchingMods}
								onSearchChange={setInactiveModSearch}
								onDropMod={moveMod}
								onSelectMod={selectMod}
								searchValue={inactiveModSearch}
								title='Inactive mods'
								type='inactive'
							/>
							<ModList
								count={activeMods.length}
								dimNonMatchingMods={activeDimNonMatchingMods}
								isLoading={modListLoadState === 'loading'}
								emptyMessage={hasModList
									? 'No active mods.'
									: 'Import a mod list or configure your RimWorld paths.'}
								mods={visibleActiveMods}
								activeDiagnosticsByPackageId={activeModDiagnostics
									.byPackageId}
								outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
								modDetailsByPackageId={modDetailsByPackageId}
								onDimNonMatchingModsChange={setActiveDimNonMatchingMods}
								onSearchChange={setActiveModSearch}
								onDropMod={moveMod}
								onSelectMod={selectMod}
								searchValue={activeModSearch}
								title='Active mods'
								type='active'
							/>
						</div>
						<p
							aria-live='polite'
							className='mt-3 shrink-0 text-sm text-muted-foreground'
						>
							{status}
						</p>
					</>
				)}
		</section>
	);
}
