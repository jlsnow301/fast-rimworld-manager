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
export function ModPreviewFeature() {
	const { closeModPreview, previewMessage, selectedMod, steamPreview } =
		useAppContext();
	if (!selectedMod) return null;

	const lastUpdated = steamPreview?.timeUpdated
		? new Date(steamPreview.timeUpdated * 1000).toLocaleString()
		: null;

	return (
		<Card className='mt-4'>
			<CardHeader className='flex flex-row items-center justify-between'>
				<CardTitle>{selectedMod.name}</CardTitle>
				<CardAction>
					<Button onClick={closeModPreview} size='sm' variant='outline'>
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
							<Badge variant='outline'>{selectedMod.source}</Badge>
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
