import '@/globals.css';
import { useAtomValue } from 'jotai';
import { settingsOpenAtom } from '@/features/settings/atoms';
import { AppProvider } from '@/context/app-context';
import { AppHeader } from '@/features/header/app-header';
import { ModListFeature } from '@/features/mod-list/mod-list-feature';
import { SettingsFeature } from '@/features/settings/settings-feature';
import { useAppController } from '@/hooks/use-app-controller';

export function App() {
	const controller = useAppController();
	const settingsOpen = useAtomValue(settingsOpenAtom);

	return (
		<AppProvider value={controller}>
			<main className='flex h-dvh min-h-0 flex-col overflow-hidden'>
				<div className='shrink-0'>
					<AppHeader />
				</div>
				{settingsOpen
					? (
						<div className='min-h-0 flex-1 overflow-y-auto'>
							<SettingsFeature />
						</div>
					)
					: <ModListFeature />}
			</main>
		</AppProvider>
	);
}
