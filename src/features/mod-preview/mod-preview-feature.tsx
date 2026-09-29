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
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '../../context/app-context';
import { activeModDiagnosticsAtom } from '../mod-list/atoms';
import { previewMessageAtom, selectedModAtom, steamPreviewAtom } from './atoms';
import { normalizedPackageId } from '../../utils/mods';
import type { ModIssue } from '../../utils/types';

export function ModPreviewFeature() {
	const { closeModPreview } = useAppContext();
	const activeModDiagnostics = useAtomValue(activeModDiagnosticsAtom);
	const previewMessage = useAtomValue(previewMessageAtom);
	const selectedMod = useAtomValue(selectedModAtom);
	const steamPreview = useAtomValue(steamPreviewAtom);
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

	const lastUpdated = steamPreview?.timeUpdated
		? new Date(steamPreview.timeUpdated * 1000).toLocaleString()
		: null;
	const diagnostics = activeModDiagnostics.byPackageId.get(
		normalizedPackageId(selectedMod.packageId),
	);

	return (
		<Card className='min-w-0'>
			<CardHeader className='flex flex-row items-center justify-between'>
				<CardTitle>{selectedMod.name}</CardTitle>
				<CardAction>
					<Button
						onClick={closeModPreview}
						size='sm'
						variant='outline'
					>
						Close
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<dl className='grid gap-2 text-sm'>
					<div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3'>
						<dt className='font-medium'>Package ID</dt>
						<dd className='break-all'>{selectedMod.packageId}</dd>
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
						<dt className='font-medium'>Installed path</dt>
						<dd className='break-all'>{selectedMod.path}</dd>
					</div>
					{selectedMod.publishedFileId && (
						<div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-3'>
							<dt className='font-medium'>Steam Workshop ID</dt>
							<dd>{selectedMod.publishedFileId}</dd>
						</div>
					)}
				</dl>
				{diagnostics &&
					(diagnostics.errors.length > 0 ||
						diagnostics.warnings.length > 0) &&
					(
						<>
							<Separator />
							<section
								aria-label='Active mod list errors and warnings'
								className='flex flex-col gap-3'
							>
								<h4 className='font-semibold'>
									Active mod list checks
								</h4>
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
						</>
					)}
				{selectedMod.description && (
					<>
						<Separator />
						<section className='flex flex-col gap-2'>
							<h4 className='font-semibold'>About this mod</h4>
							<p className='whitespace-pre-wrap text-sm text-muted-foreground'>
								{selectedMod.description}
							</p>
						</section>
					</>
				)}
				{steamPreview && (
					<>
						<Separator />
						<section className='flex flex-col gap-2'>
							<h4 className='font-semibold'>Steam Workshop</h4>
							<p className='font-medium'>{steamPreview.title}</p>
							{lastUpdated && (
								<p className='text-sm text-muted-foreground'>
									Last updated {lastUpdated}
								</p>
							)}
							{steamPreview.previewUrl && (
								<img
									className='max-h-80 max-w-full self-start object-contain'
									src={steamPreview.previewUrl}
									alt={`Steam Workshop preview for ${steamPreview.title}`}
								/>
							)}
							{steamPreview.description && (
								<p className='whitespace-pre-wrap text-sm text-muted-foreground'>
									{steamPreview.description}
								</p>
							)}
						</section>
					</>
				)}
				<p aria-live='polite' className='text-sm text-muted-foreground'>
					{previewMessage}
				</p>
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
