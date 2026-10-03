import { useAtomValue } from 'jotai';
import { FileDown, FileUp, Save, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	hasModListAtom,
	isModListDirtyAtom,
	isTestModeAtom,
	modListLoadStateAtom,
	sourceNameAtom,
} from '@/features/mod-list/atoms';
import { settingsOpenAtom } from '@/features/settings/atoms';
import { useAppContext } from '@/context/app-context';

export function AppHeader() {
	const {
		importModList,
		exportActiveModList,
		toggleSettings,
		saveModList,
	} = useAppContext();
	const hasModList = useAtomValue(hasModListAtom);
	const modListLoadState = useAtomValue(modListLoadStateAtom);
	const isModListDirty = useAtomValue(isModListDirtyAtom);
	const isTestMode = useAtomValue(isTestModeAtom);
	const settingsOpen = useAtomValue(settingsOpenAtom);
	const sourceName = useAtomValue(sourceNameAtom);
	const visibleSourceName = sourceName === 'ModsConfig.xml' ? '' : sourceName;

	return (
		<header className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3'>
			<div>
				<h1 className='text-lg font-semibold tracking-wide'>
					Fast RimWorld Manager
				</h1>
			</div>
			<div className='flex max-w-full flex-wrap items-center justify-end gap-2'>
				{(visibleSourceName || modListLoadState === 'loading' ||
					modListLoadState === 'failed' || !hasModList) && (
					<Badge
						aria-live='polite'
						className='max-w-48 truncate'
						variant='outline'
					>
						{visibleSourceName || (modListLoadState === 'loading'
							? 'Loading mod list…'
							: modListLoadState === 'failed'
							? 'Mod list failed to load'
							: 'No mod list loaded')}
					</Badge>
				)}
				{isTestMode && <Badge variant='secondary'>TEST MODE</Badge>}
				{isModListDirty && (
					<Badge variant='secondary' aria-live='polite'>
						Unsaved changes
					</Badge>
				)}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-label='Import'
									disabled={isTestMode}
									onClick={importModList}
									size='icon-sm'
									type='button'
									variant='outline'
								>
									<FileUp aria-hidden='true' />
								</Button>
							}
						>
							Import
						</TooltipTrigger>
						<TooltipContent>Import</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-label='Export'
									disabled={!hasModList || isTestMode}
									onClick={exportActiveModList}
									size='icon-sm'
									type='button'
									variant='outline'
								>
									<FileDown aria-hidden='true' />
								</Button>
							}
						>
							Export
						</TooltipTrigger>
						<TooltipContent>Export</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-label='Save'
									disabled={!hasModList || isTestMode}
									onClick={saveModList}
									size='icon-sm'
									type='button'
									variant={isModListDirty
										? 'default'
										: 'outline'}
								>
									<Save aria-hidden='true' />
								</Button>
							}
						>
							Save
						</TooltipTrigger>
						<TooltipContent>Save</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									aria-expanded={settingsOpen}
									aria-label='Settings'
									onClick={toggleSettings}
									size='icon-sm'
									type='button'
									variant='outline'
								>
									<Settings aria-hidden='true' />
								</Button>
							}
						>
							Settings
						</TooltipTrigger>
						<TooltipContent>Settings</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</header>
	);
}
