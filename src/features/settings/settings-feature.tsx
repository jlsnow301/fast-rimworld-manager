import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAppContext } from '../../context/app-context';
import { PATH_FIELDS } from '../../utils/mods';
import type { DatabaseKind, PathSettings } from '../../utils/types';

type DatabaseOption = {
	id: DatabaseKind;
	label: string;
	description: string;
};

const DATABASES: DatabaseOption[] = [
	{
		id: 'communityRules',
		label: 'Community Rules',
		description: 'Community-curated mod load-order rules.',
	},
	{
		id: 'steamWorkshop',
		label: 'Steam Workshop',
		description: 'Mod metadata and dependency information.',
	},
];

export function SettingsFeature() {
	const {
		autoDetectPaths,
		browsePath,
		databaseMessage,
		downloadDatabase,
		downloadingDatabase,
		pathSettings,
		savePathSettings,
		settingsMessage,
		updatePath,
	} = useAppContext();

	return (
		<section className='mx-auto w-full max-w-5xl p-6'>
			<Card>
				<CardHeader>
					<CardTitle>Settings</CardTitle>
					<CardDescription>RimWorld and mod folder locations</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-5'>
					<div className='flex flex-wrap gap-2'>
						<Button onClick={autoDetectPaths} variant='outline'>
							Auto-detect paths
						</Button>
						<Button onClick={savePathSettings}>Save paths</Button>
					</div>
					<FieldGroup className='gap-4'>
						{PATH_FIELDS.map((field) => (
							<PathField
								key={field.key}
								label={field.label}
								name={field.key}
								onBrowse={() => browsePath(field.key, field.label)}
								onChange={updatePath}
								value={pathSettings[field.key]}
							/>
						))}
					</FieldGroup>
					<p aria-live='polite' className='text-sm text-muted-foreground'>
						{settingsMessage}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Databases</CardTitle>
					<CardDescription>
						Download compatible metadata from the RimSort database projects.
					</CardDescription>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					{DATABASES.map((database) => (
						<div
							className='flex flex-wrap items-center justify-between gap-3'
							key={database.id}
						>
							<div>
								<h3 className='font-medium'>{database.label}</h3>
								<p className='text-sm text-muted-foreground'>
									{database.description}
								</p>
							</div>
							<Button
								aria-label={`Download or update ${database.label} database`}
								disabled={downloadingDatabase !== null}
								onClick={() => downloadDatabase(database.id)}
								variant='outline'
							>
								{downloadingDatabase === database.id
									? 'Downloading…'
									: 'Download / update'}
							</Button>
						</div>
					))}
					<p aria-live='polite' className='text-sm text-muted-foreground'>
						{databaseMessage}
					</p>
				</CardContent>
			</Card>
		</section>
	);
}

type PathFieldProps = {
	label: string;
	name: keyof PathSettings;
	onBrowse: () => void;
	onChange: (key: keyof PathSettings, value: string) => void;
	value: string;
};

function PathField(props: PathFieldProps) {
	const { label, name, onBrowse, onChange, value } = props;
	return (
		<Field>
			<FieldLabel htmlFor={`path-${name}`}>{label}</FieldLabel>
			<div className='flex gap-2'>
				<Input
					autoComplete='off'
					id={`path-${name}`}
					onChange={(event) => onChange(name, event.currentTarget.value)}
					placeholder='Enter folder path'
					spellCheck={false}
					value={value}
				/>
				<Button onClick={onBrowse} variant='outline'>
					Browse
				</Button>
			</div>
		</Field>
	);
}
