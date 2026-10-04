import { cn } from 'cn';
import { Globe, Info, X } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppContext } from '@/context/app-context';
import { activeModDiagnosticsAtom } from '@/features/mod-list/atoms';
import {
	previewMessageAtom,
	selectedModAtom,
	steamPreviewAtom,
} from '@/features/mod-preview/atoms';
import { steamWorkshopPageUrls } from '@/utils/workshop_update_urls';
import { normalizedPackageId } from '@/utils/mods';
import type { ModIssue } from '@/utils/types';

export function ModPreviewFeature() {
	const { closeModPreview } = useAppContext();
	const activeModDiagnostics = useAtomValue(activeModDiagnosticsAtom);
	const selectedMod = useAtomValue(selectedModAtom);
	const previewMessage = useAtomValue(previewMessageAtom);
	const steamPreview = useAtomValue(steamPreviewAtom);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [loadedPreviewUrl, setLoadedPreviewUrl] = useState<string | null>(
		null,
	);
	const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(
		null,
	);
	const [linkError, setLinkError] = useState('');
	const isSteamPreviewLoading =
		previewMessage === 'Loading Steam Workshop details…';
	const previewImageUrl = steamPreview?.previewUrl;
	const previewImageLoaded = Boolean(
		previewImageUrl && previewImageUrl === loadedPreviewUrl,
	);
	const previewImageFailed = Boolean(
		previewImageUrl && previewImageUrl === failedPreviewUrl,
	);
	const isPreviewImageLoading = isSteamPreviewLoading ||
		Boolean(
			previewImageUrl && !previewImageLoaded && !previewImageFailed,
		);

	if (!selectedMod) {
		return (
			<Card className='h-[48dvh] max-h-full min-h-0 min-w-0'>
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
		<Card className='h-[48dvh] max-h-full gap-1 min-h-0 min-w-0 py-0'>
			<CardHeader className='flex flex-row items-center justify-between px-2'>
				<CardTitle className='text-base tracking-normal'>
					{selectedMod.name}
				</CardTitle>
				<CardAction className='flex gap-2'>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label='Show on-disk details'
										onClick={() => setDetailsOpen(true)}
										size='icon-sm'
										type='button'
										variant='outline'
									/>
								}
							>
								<Info
									aria-hidden='true'
									data-icon='inline-start'
								/>
							</TooltipTrigger>
							<TooltipContent>
								Show on-disk details
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										aria-label='Close mod preview'
										onClick={closeModPreview}
										size='icon-sm'
										type='button'
										variant='outline'
									/>
								}
							>
								<X
									aria-hidden='true'
									data-icon='inline-start'
								/>
							</TooltipTrigger>
							<TooltipContent>Close mod preview</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</CardAction>
			</CardHeader>
			<CardContent className='flex min-h-0 flex-1 flex-col gap-1'>
				<div className='flex h-5 shrink-0 items-center justify-between gap-2'>
					{isSteamPreviewLoading
						? <Skeleton className='h-4 w-1/3' />
						: selectedMod.author && (
							<p className='text-sm text-muted-foreground'>
								{selectedMod.author}
							</p>
						)}
					{selectedMod.modVersion && (
						<p
							aria-label='Mod version'
							className='ml-auto text-sm text-muted-foreground'
						>
							Version {selectedMod.modVersion}
						</p>
					)}
				</div>
				<div
					aria-label={isPreviewImageLoading
						? 'Loading mod preview image'
						: undefined}
					className='relative flex min-h-0 w-full flex-1 items-center justify-center rounded-md p-3 sm:p-4'
					data-slot='mod-preview-image'
					role={isPreviewImageLoading ? 'status' : undefined}
				>
					{isPreviewImageLoading && (
						<Skeleton className='absolute inset-3 sm:inset-4' />
					)}
					{previewImageUrl && (
						<img
							alt={`${selectedMod.name} Workshop preview`}
							className={cn(
								'max-h-full max-w-full object-contain',
								!previewImageLoaded && 'invisible',
							)}
							onError={() => setFailedPreviewUrl(previewImageUrl)}
							onLoad={() => setLoadedPreviewUrl(previewImageUrl)}
							src={previewImageUrl}
						/>
					)}
				</div>
				<div className='mt-auto flex gap-2'>
					{workshopPageUrls && (
						<>
							<Button
								className='min-w-0 flex-1'
								onClick={() =>
									void openWorkshopPage(
										workshopPageUrls.browser,
									)}
								size='sm'
								variant='outline'
							>
								<Globe
									aria-hidden='true'
									data-icon='inline-start'
								/>
								Browser
							</Button>
							<Button
								className='min-w-0 flex-1'
								onClick={() =>
									void openWorkshopPage(
										workshopPageUrls.steam,
									)}
								size='sm'
								variant='outline'
							>
								<svg
									aria-hidden='true'
									className='size-4 fill-current'
									data-icon='inline-start'
									focusable='false'
									viewBox='0 0 24 24'
									xmlns='http://www.w3.org/2000/svg'
								>
									<path d='M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015s1.35 3.015 3.015 3.015c1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266s-1.017 2.265-2.266 2.265c-1.253 0-2.265-1.013-2.265-2.265z' />
								</svg>
								Steam
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
						className='h-[min(85vh,48rem)] w-[min(85vw,48rem)] max-w-none overflow-x-hidden overflow-y-auto data-closed:hidden sm:max-w-none'
					>
						<DialogHeader>
							<DialogTitle>Mod details</DialogTitle>
							<DialogDescription>
								Information read from the installed mod.
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
							<p className='whitespace-pre-wrap break-words text-sm text-muted-foreground'>
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
			<ul className='list-inside list-disc break-words text-sm text-muted-foreground'>
				{issue.details.map((detail) => <li key={detail}>{detail}</li>)}
			</ul>
		</div>
	);
}
