import { cn } from 'cn';
import {
	BookOpen,
	CircleAlert,
	Crown,
	Dna,
	Download,
	Gamepad2,
	Ghost,
	type LucideIcon,
	Rocket,
	TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { MOD_DRAG_MIME } from '@/utils/mod_drag';
import { normalizedPackageId } from '@/utils/mods';
import type {
	ModHighlightState,
	ModListType,
	OutdatedWorkshopMod,
} from '@/utils/types';

const OFFICIAL_CONTENT_ICONS: Record<string, LucideIcon> = {
	'ludeon.rimworld': Gamepad2,
	'ludeon.rimworld.royalty': Crown,
	'ludeon.rimworld.ideology': BookOpen,
	'ludeon.rimworld.biotech': Dna,
	'ludeon.rimworld.anomaly': Ghost,
	'ludeon.rimworld.odyssey': Rocket,
};

export type ModListRowData = {
	packageId: string;
	index: number;
	isMatch: boolean;
	name: string;
	diagnostics?: ModHighlightState;
	outdatedWorkshopMod?: OutdatedWorkshopMod;
};

export type ModListRowProps = {
	data: ModListRowData;
	type: ModListType;
	onSelectMod: (packageId: string) => void;
};

export function ModListRow(props: ModListRowProps) {
	const { data, type, onSelectMod } = props;
	const {
		packageId,
		index,
		isMatch,
		name,
		diagnostics,
		outdatedWorkshopMod,
	} = data;
	const normalizedId = normalizedPackageId(packageId);
	const OfficialContentIcon = OFFICIAL_CONTENT_ICONS[normalizedId];
	const errorDetails = diagnostics?.errors
		.map((issue) => `${issue.title}: ${issue.details.join(', ')}`)
		.join('. ');
	const warningDetails = diagnostics?.warnings
		.map((issue) => `${issue.title}: ${issue.details.join(', ')}`)
		.join('. ');
	const updateDetails = outdatedWorkshopMod
		? `Steam update available. Latest Workshop update: ${
			new Date(outdatedWorkshopMod.steamTimeUpdated * 1000)
				.toLocaleString()
		}.`
		: undefined;
	const accessibleIssues = [
		errorDetails && `Errors: ${errorDetails}`,
		warningDetails && `Warnings: ${warningDetails}`,
		updateDetails,
	].filter(Boolean).join('. ');
	const canDrag = type !== 'active' || normalizedId !== 'ludeon.rimworld';

	return (
		<Button
			aria-label={`Show details for ${name}${
				accessibleIssues ? `. ${accessibleIssues}` : ''
			}`}
			className={cn(
				'h-auto min-h-12 w-full justify-start rounded-none px-3 py-2 text-left normal-case tracking-normal',
				canDrag
					? 'cursor-grab active:cursor-grabbing'
					: 'cursor-default',
				diagnostics?.errors.length &&
					'border-l-2 border-destructive',
				!diagnostics?.errors.length &&
					diagnostics?.warnings.length &&
					'border-l-2 border-muted-foreground',
			)}
			draggable={canDrag}
			onClick={() => onSelectMod(packageId)}
			onDragStart={(event) => {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData(
					MOD_DRAG_MIME,
					JSON.stringify({ index, source: type }),
				);
			}}
			variant='ghost'
		>
			<span
				className={cn(
					'flex w-full min-w-0 flex-1 items-center gap-2',
					!isMatch && 'opacity-50',
				)}
			>
				{OfficialContentIcon && (
					<OfficialContentIcon
						aria-hidden='true'
						data-icon='inline-start'
						className='mt-0.5 shrink-0 text-muted-foreground'
						focusable='false'
					/>
				)}
				<span className='min-w-0 flex-1 truncate'>{name}</span>
				{(errorDetails || warningDetails || updateDetails) && (
					<TooltipProvider>
						<span className='ml-auto flex shrink-0 items-center gap-1'>
							{errorDetails && (
								<Tooltip>
									<TooltipTrigger
										render={<span className='shrink-0' />}
									>
										<CircleAlert
											aria-hidden='true'
											className='shrink-0 text-destructive'
											focusable='false'
										/>
									</TooltipTrigger>
									<TooltipContent>
										{errorDetails}
									</TooltipContent>
								</Tooltip>
							)}
							{warningDetails && (
								<Tooltip>
									<TooltipTrigger
										render={<span className='shrink-0' />}
									>
										<TriangleAlert
											aria-hidden='true'
											className='shrink-0 text-muted-foreground'
											focusable='false'
										/>
									</TooltipTrigger>
									<TooltipContent>
										{warningDetails}
									</TooltipContent>
								</Tooltip>
							)}
							{updateDetails && (
								<Tooltip>
									<TooltipTrigger
										render={<span className='shrink-0' />}
									>
										<Download
											aria-hidden='true'
											className='shrink-0 text-muted-foreground'
											focusable='false'
										/>
									</TooltipTrigger>
									<TooltipContent>
										{updateDetails}
									</TooltipContent>
								</Tooltip>
							)}
						</span>
					</TooltipProvider>
				)}
			</span>
		</Button>
	);
}
