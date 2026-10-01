import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
	activeModDiagnosticsAtom,
	activeModsAtom,
	checkingWorkshopUpdatesAtom,
	dimNonMatchingModsAtom,
	gameVersionAtom,
	hasModListAtom,
	hasWorkshopModsAtom,
	inactiveModsAtom,
	isTestModeAtom,
	modDetailsByPackageIdAtom,
	modListLoadStateAtom,
	modSearchAtom,
	outdatedWorkshopModsByPackageIdAtom,
	statusAtom,
	visibleActiveModsAtom,
	visibleInactiveModsAtom,
	workshopUpdateStatusAtom,
} from '@/features/mod-list/atoms';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/app-context';
import { allWorkshopUpdateIds } from '@/utils/workshop_update_selection';
import { ModPreviewFeature } from '@/features/mod-preview/mod-preview-feature';
import { ModListPanel } from '@/features/mod-list/components/mod-list-panel';
import { WorkshopUpdatesPage } from '@/features/mod-list/components/workshop-updates-page';

export function ModListFeature() {
	const { moveMod, sortMods, selectMod, checkForModUpdates } =
		useAppContext();
	const activeMods = useAtomValue(activeModsAtom);
	const dimNonMatchingMods = useAtomValue(dimNonMatchingModsAtom);
	const setDimNonMatchingMods = useSetAtom(dimNonMatchingModsAtom);
	const inactiveMods = useAtomValue(inactiveModsAtom);
	const modSearch = useAtomValue(modSearchAtom);
	const setModSearch = useSetAtom(modSearchAtom);
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
									{activeMods.length} active ·{' '}
									{inactiveMods.length} inactive
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
						<p className='mb-3 text-sm text-muted-foreground'>
							Drag mods between the lists to change activation.
						</p>
						<p
							aria-live='polite'
							className='mb-3 flex flex-wrap items-center gap-2 text-sm'
							role={modListLoadState === 'failed' ||
									(activeModDiagnostics.errorCount > 0 &&
										modListLoadState === 'loaded')
								? 'alert'
								: 'status'}
						>
							{modListLoadState === 'loading'
								? <span>Loading mod list…</span>
								: modListLoadState === 'failed'
								? (
									<Badge variant='destructive'>
										Mod list failed to load
									</Badge>
								)
								: (
									<>
										<span>Active mod list checks:</span>
										{!hasModList
											? (
												<Badge variant='secondary'>
													No active list loaded
												</Badge>
											)
											: activeModDiagnostics.errorCount >
													0
											? (
												<Badge variant='destructive'>
													{activeModDiagnostics
														.errorCount}{' '}
													mods with errors
												</Badge>
											)
											: (
												<Badge variant='secondary'>
													No errors
												</Badge>
											)}
										{activeModDiagnostics.warningCount >
												0 && (
											<Badge variant='outline'>
												{activeModDiagnostics
													.warningCount}{' '}
												mods with warnings
											</Badge>
										)}
										{hasModList &&
											(activeModDiagnostics.errorCount >
													0 ||
												activeModDiagnostics
														.warningCount > 0) &&
											(
												<span className='text-muted-foreground'>
													Select a highlighted mod for
													details.
												</span>
											)}
									</>
								)}
						</p>
						<div className='mb-3 flex flex-wrap items-center gap-3'>
							<Input
								aria-label='Search installed mods'
								className='min-w-64 max-w-2xl flex-1'
								onChange={(event) =>
									setModSearch(event.currentTarget.value)}
								placeholder='Search names or package IDs'
								value={modSearch}
							/>
							<label className='flex shrink-0 items-center gap-2 text-sm'>
								<Checkbox
									checked={dimNonMatchingMods}
									onCheckedChange={(checked) =>
										setDimNonMatchingMods(checked === true)}
								/>
								<span>Dim non-matching mods</span>
							</label>
						</div>
						<div className='grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1'>
							<div className='min-h-0 overflow-y-auto'>
								<ModPreviewFeature />
							</div>
							<ModListPanel
								count={inactiveMods.length}
								isLoading={modListLoadState === 'loading'}
								emptyMessage='No inactive mods found. Configure paths in Settings.'
								mods={visibleInactiveMods}
								activeDiagnosticsByPackageId={activeModDiagnostics
									.byPackageId}
								outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
								modDetailsByPackageId={modDetailsByPackageId}
								onDropMod={moveMod}
								onSelectMod={selectMod}
								title='Inactive mods'
								type='inactive'
							/>
							<ModListPanel
								count={activeMods.length}
								isLoading={modListLoadState === 'loading'}
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
