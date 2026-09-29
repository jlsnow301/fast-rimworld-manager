import { createContext, type PropsWithChildren, useContext } from 'react';
import type { AppController } from '@/hooks/use-app-controller';

const AppContext = createContext<AppController | null>(null);

export function AppProvider(
	props: PropsWithChildren<{ value: AppController }>,
) {
	const { value, children } = props;

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error('App features must be rendered inside AppProvider.');
	}
	return context;
}
