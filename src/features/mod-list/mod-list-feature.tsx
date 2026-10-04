import { Check, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
	activeDimNonMatchingModsAtom,
	activeErrorFilterAtom,
	activeModDiagnosticsAtom,
	activeModsAtom,
	activeModSearchAtom,
	activeWarningFilterAtom,
	checkingWorkshopUpdatesAtom,
	gameVersionAtom,
	hasModListAtom,
	hasWorkshopModsAtom,
	inactiveDimNonMatchingModsAtom,
	inactiveErrorFilterAtom,
	inactiveModsAtom,
	inactiveModSearchAtom,
	inactiveWarningFilterAtom,
	isTestModeAtom,
	modDetailsByPackageIdAtom,
	modListLoadStateAtom,
	outdatedWorkshopModsByPackageIdAtom,
	statusAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
	workshopUpdateResultAtom,
	workshopUpdateStatusAtom,
} from '@/features/mod-list/atoms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/app-context';
import { allWorkshopUpdateIds } from '@/utils/workshop_update_selection';
import { ModPreviewFeature } from '@/features/mod-preview/mod-preview-feature';
import { ModList } from '@/features/mod-list/components/mod-list';
import { WorkshopUpdatesPage } from '@/features/mod-list/components/workshop-updates-page';
import { ModListDragDropProvider } from '@/features/mod-list/components/mod-list-drag-drop-provider';

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
	const activeWarningFilter = useAtomValue(activeWarningFilterAtom);
	const setActiveWarningFilter = useSetAtom(activeWarningFilterAtom);
	const activeErrorFilter = useAtomValue(activeErrorFilterAtom);
	const setActiveErrorFilter = useSetAtom(activeErrorFilterAtom);
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
	const inactiveWarningFilter = useAtomValue(inactiveWarningFilterAtom);
	const setInactiveWarningFilter = useSetAtom(inactiveWarningFilterAtom);
	const inactiveErrorFilter = useAtomValue(inactiveErrorFilterAtom);
	const setInactiveErrorFilter = useSetAtom(inactiveErrorFilterAtom);
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
	const updateCount = useAtomValue(workshopUpdateResultAtom)?.outdatedMods
		.length ?? 0;
	const checkForUpdatesLabel = isTestMode
		? 'Preview Workshop updates'
		: 'Check for updates';
	const checkForUpdatesAriaLabel = updateCount > 0
		? `${checkForUpdatesLabel}, ${updateCount} update${
			updateCount === 1 ? '' : 's'
		} available`
		: checkForUpdatesLabel;
	const displayedUpdateCount = updateCount > 9 ? '9+' : updateCount;
	const hasCheckedForUpdatesOnStartup = useRef(false);
	const [showNoUpdatesCheck, setShowNoUpdatesCheck] = useState(false);

	useEffect(() => {
		if (workshopUpdateStatus?.state !== 'no-updates') {
			setShowNoUpdatesCheck(false);
			return;
		}

		setShowNoUpdatesCheck(true);
		const timeout = globalThis.setTimeout(
			() => setShowNoUpdatesCheck(false),
			1800,
		);
		return () => globalThis.clearTimeout(timeout);
	}, [workshopUpdateStatus?.state]);

	useEffect(() => {
		if (
			modListLoadState !== 'loaded' || isTestMode || !hasWorkshopMods ||
			hasCheckedForUpdatesOnStartup.current
		) return;
		hasCheckedForUpdatesOnStartup.current = true;
		void checkForModUpdates();
	}, [checkForModUpdates, hasWorkshopMods, isTestMode, modListLoadState]);

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
									aria-label={checkForUpdatesAriaLabel}
									aria-describedby={workshopUpdateStatus
											?.state ===
											'incomplete'
										? 'workshop-update-incomplete'
										: undefined}
									disabled={checkingWorkshopUpdates ||
										(!isTestMode && !hasWorkshopMods)}
									onClick={handleCheckForUpdates}
									size='sm'
									variant='outline'
								>
									{checkingWorkshopUpdates
										? (
											<LoaderCircle
												className='animate-spin'
												data-icon='inline-start'
												role='img'
												aria-label='Checking for Workshop updates'
											/>
										)
										: showNoUpdatesCheck
										? <Check data-icon='inline-start' />
										: null}
									{checkForUpdatesLabel}
									{updateCount > 0 && (
										<Badge
											aria-hidden='true'
											className='size-5 rounded-full border border-current px-0 py-0 tracking-normal'
											variant='outline'
										>
											{displayedUpdateCount}
										</Badge>
									)}
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
							{workshopUpdateStatus?.state === 'incomplete' && (
								<Badge
									id='workshop-update-incomplete'
									aria-live='polite'
									role='status'
									variant='outline'
								>
									{workshopUpdateStatus.message}
								</Badge>
							)}
						</div>
						<ModListDragDropProvider onDropMod={moveMod}>
							<div className='grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1'>
								<div className='min-h-0'>
									<ModPreviewFeature />
								</div>
								<ModList
									filterWarnings={inactiveWarningFilter}
									filterErrors={inactiveErrorFilter}
									count={inactiveMods.length}
									dimNonMatchingMods={inactiveDimNonMatchingMods}
									isLoading={modListLoadState === 'loading'}
									emptyMessage='No inactive mods found. Configure paths in Settings.'
									mods={visibleInactiveMods}
									activeDiagnosticsByPackageId={activeModDiagnostics
										.byPackageId}
									outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
									modDetailsByPackageId={modDetailsByPackageId}
									onFilterWarningsChange={setInactiveWarningFilter}
									onFilterErrorsChange={setInactiveErrorFilter}
									onDimNonMatchingModsChange={setInactiveDimNonMatchingMods}
									onSearchChange={setInactiveModSearch}
									onSelectMod={selectMod}
									searchValue={inactiveModSearch}
									title='Inactive mods'
									type='inactive'
								/>
								<ModList
									filterWarnings={activeWarningFilter}
									filterErrors={activeErrorFilter}
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
									onFilterWarningsChange={setActiveWarningFilter}
									onFilterErrorsChange={setActiveErrorFilter}
									onDimNonMatchingModsChange={setActiveDimNonMatchingMods}
									onSearchChange={setActiveModSearch}
									onSelectMod={selectMod}
									searchValue={activeModSearch}
									title='Active mods'
									type='active'
								/>
							</div>
						</ModListDragDropProvider>
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
