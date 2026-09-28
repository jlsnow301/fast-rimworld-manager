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
import { normalizedPackageId } from '../../utils/mods';
import { useAppContext } from '../../context/app-context';
export function ModPreviewFeature() {
	const {
		closeModPreview,
		modHighlights,
		previewMessage,
		selectedMod,
		steamPreview,
	} = useAppContext();
	if (!selectedMod) return null;

	const lastUpdated = steamPreview?.timeUpdated
		? new Date(steamPreview.timeUpdated * 1000).toLocaleString()
		: null;
	const highlights = modHighlights.get(
		normalizedPackageId(selectedMod.packageId),
	);
	const missingDependencyNames = highlights?.missingDependencies
		.map((dependency) => dependency.name)
		.join(', ');
	const loadOrderDetails = highlights?.loadOrderViolations
		.map(({ relation, packageId }) => `Should load ${relation} ${packageId}`)
		.join('. ');

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
				{(missingDependencyNames || loadOrderDetails) && (
					<>
						<Separator />
						<section
							aria-label='Mod compatibility checks'
							className='flex flex-col gap-2'
						>
							<h4 className='font-semibold'>Mod compatibility checks</h4>
							{missingDependencyNames && (
								<div className='flex flex-col gap-1'>
									<Badge className='self-start' variant='destructive'>
										Missing dependencies
									</Badge>
									<p className='text-sm text-muted-foreground'>
										{missingDependencyNames}
									</p>
								</div>
							)}
							{loadOrderDetails && (
								<div className='flex flex-col gap-1'>
									<Badge className='self-start' variant='outline'>
										Load order
									</Badge>
									<p className='text-sm text-muted-foreground'>
										{loadOrderDetails}
									</p>
								</div>
							)}
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
