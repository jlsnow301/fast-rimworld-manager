import { useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAtomValue } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '@/context/app-context';
import { activeModDiagnosticsAtom } from '@/features/mod-list/atoms';
import {
	previewMessageAtom,
	selectedModAtom,
	steamPreviewAtom,
} from '@/features/mod-preview/atoms';
import { normalizedPackageId } from '@/utils/mods';
import { steamWorkshopPageUrls } from '@/utils/workshop_update_urls';
import type { ModIssue } from '@/utils/types';

export function ModPreviewFeature() {
	const { closeModPreview } = useAppContext();
	const activeModDiagnostics = useAtomValue(activeModDiagnosticsAtom);
	const previewMessage = useAtomValue(previewMessageAtom);
	const selectedMod = useAtomValue(selectedModAtom);
	const steamPreview = useAtomValue(steamPreviewAtom);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [linkError, setLinkError] = useState('');

	if (!selectedMod) {
		return (
			<Card className='min-w-0'>
				<CardHeader>
					<CardTitle>Mod preview</CardTitle>
				</CardHeader>
				<CardContent>
					<p className='text-sm text-muted-foreground'>
						Select a mod to see its details.
					</p>
				</CardContent>
			</Card>
		);
	}

	const workshopPageUrls = steamWorkshopPageUrls(
		selectedMod.publishedFileId,
	);
	const lastUpdated = steamPreview?.timeUpdated
		? new Date(steamPreview.timeUpdated * 1000).toLocaleString()
		: null;
	const diagnostics = activeModDiagnostics.byPackageId.get(
		normalizedPackageId(selectedMod.packageId),
	);

	async function openWorkshopPage(url: string) {
		setLinkError('');
		try {
			await openUrl(url);
		} catch {
			setLinkError('Could not open the Workshop page.');
		}
	}

	return (
		<Card className='min-w-0'>
			<CardHeader className='flex flex-row items-center justify-between'>
				<CardTitle>{selectedMod.name}</CardTitle>
				<CardAction className='flex gap-2'>
					<Button
						onClick={() => setDetailsOpen(true)}
						size='sm'
						variant='outline'
					>
						Info
					</Button>
					<Button
						onClick={closeModPreview}
						size='sm'
						variant='outline'
					>
						Close
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				{selectedMod.author && (
					<p className='text-sm text-muted-foreground'>
						{selectedMod.author}
					</p>
				)}
				{steamPreview?.previewUrl && (
					<img
						className='max-h-32 max-w-full self-start object-contain'
						src={steamPreview.previewUrl}
						alt={`${selectedMod.name} Workshop preview`}
					/>
				)}
				<div className='flex flex-wrap gap-2'>
					{workshopPageUrls && (
						<>
							<Button
								onClick={() =>
									void openWorkshopPage(
										workshopPageUrls.browser,
									)}
								size='sm'
								variant='outline'
							>
								Open in browser
							</Button>
							<Button
								onClick={() =>
									void openWorkshopPage(
										workshopPageUrls.steam,
									)}
								size='sm'
								variant='outline'
							>
								Open in Steam
							</Button>
						</>
					)}
				</div>
				{linkError && (
					<p role='status' className='text-sm text-muted-foreground'>
						{linkError}
					</p>
				)}
				<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
					<DialogContent
						showCloseButton={false}
						className='max-h-[80vh] overflow-y-auto data-closed:hidden'
					>
						<DialogHeader>
							<DialogTitle>Mod details</DialogTitle>
							<DialogDescription>
								Information read from the installed mod and
								Workshop metadata.
							</DialogDescription>
						</DialogHeader>
						<dl className='grid gap-3 text-sm'>
							<div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3'>
								<dt className='font-medium'>Package ID</dt>
								<dd className='break-all'>
									{selectedMod.packageId}
								</dd>
							</div>
							<div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3'>
								<dt className='font-medium'>Source</dt>
								<dd>
									<Badge variant='outline'>
										{selectedMod.source}
									</Badge>
								</dd>
							</div>
							<div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3'>
								<dt className='font-medium'>Install path</dt>
								<dd className='break-all'>
									{selectedMod.path}
								</dd>
							</div>
							<div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3'>
								<dt className='font-medium'>
									Steam Workshop ID
								</dt>
								<dd>
									{selectedMod.publishedFileId ??
										'Not available'}
								</dd>
							</div>
						</dl>
						<section className='flex flex-col gap-2'>
							<Separator />
							<h3 className='font-semibold'>About this mod</h3>
							<p className='whitespace-pre-wrap text-sm text-muted-foreground'>
								{selectedMod.description ||
									'No XML description available.'}
							</p>
						</section>
						{diagnostics &&
							(diagnostics.errors.length > 0 ||
								diagnostics.warnings.length > 0) &&
							(
								<section
									aria-label='Active mod list errors and warnings'
									className='flex flex-col gap-3'
								>
									<Separator />
									<h3 className='font-semibold'>
										Active mod list checks
									</h3>
									{diagnostics.errors.map((issue) => (
										<IssueDetails
											issue={issue}
											key={`error-${issue.code}`}
										/>
									))}
									{diagnostics.warnings.map((issue) => (
										<IssueDetails
											issue={issue}
											key={`warning-${issue.code}`}
										/>
									))}
								</section>
							)}
						{steamPreview && (
							<section className='flex flex-col gap-2'>
								<Separator />
								<h3 className='font-semibold'>
									Steam Workshop
								</h3>
								<p className='font-medium'>
									{steamPreview.title}
								</p>
								{lastUpdated && (
									<p className='text-sm text-muted-foreground'>
										Last updated {lastUpdated}
									</p>
								)}
								{steamPreview.description && (
									<p className='whitespace-pre-wrap text-sm text-muted-foreground'>
										{steamPreview.description}
									</p>
								)}
							</section>
						)}
						{previewMessage && (
							<p
								aria-live='polite'
								className='text-sm text-muted-foreground'
							>
								{previewMessage}
							</p>
						)}
						<DialogFooter>
							<DialogClose render={<Button />}>Close</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}

type IssueDetailsProps = {
	issue: ModIssue;
};

function IssueDetails(props: IssueDetailsProps) {
	const { issue } = props;
	return (
		<div className='flex flex-col gap-1'>
			<Badge
				className='self-start'
				variant={issue.severity === 'error' ? 'destructive' : 'outline'}
			>
				{issue.title}
			</Badge>
			<ul className='list-inside list-disc text-sm text-muted-foreground'>
				{issue.details.map((detail) => <li key={detail}>{detail}</li>)}
			</ul>
		</div>
	);
}
