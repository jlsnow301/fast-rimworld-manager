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
import { PATH_FIELDS } from '../../utils/mods';
import type { PathSettings } from '../../utils/types';
import { useAppContext } from '../../context/app-context';

export function SettingsFeature() {
	const {
		autoDetectPaths,
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
						{PATH_FIELDS.map(({ key, label }) => (
							<PathField
								key={key}
								label={label}
								name={key}
								onChange={updatePath}
								value={pathSettings[key]}
							/>
						))}
					</FieldGroup>
					<p aria-live='polite' className='text-sm text-muted-foreground'>
						{settingsMessage}
					</p>
				</CardContent>
			</Card>
		</section>
	);
}

type PathFieldProps = {
	label: string;
	name: keyof PathSettings;
	onChange: (key: keyof PathSettings, value: string) => void;
	value: string;
};

function PathField({ label, name, onChange, value }: PathFieldProps) {
	return (
		<Field>
			<FieldLabel htmlFor={`path-${name}`}>{label}</FieldLabel>
			<Input
				autoComplete='off'
				id={`path-${name}`}
				onChange={(event) => onChange(name, event.currentTarget.value)}
				placeholder='Enter folder path'
				spellCheck={false}
				value={value}
			/>
		</Field>
	);
}
