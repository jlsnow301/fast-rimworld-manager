import { createStore } from 'jotai';
import {
	hasModListAtom,
	modListLoadStateAtom,
	sourceNameAtom,
} from '@/features/mod-list/atoms.ts';

Deno.test('mod-list readiness stays distinct from whether a list exists', () => {
	const store = createStore();

	if (
		store.get(modListLoadStateAtom) !== 'loading' ||
		store.get(hasModListAtom)
	) {
		throw new Error('Startup must be loading, not an empty-list result.');
	}

	store.set(modListLoadStateAtom, 'loaded');
	if (store.get(hasModListAtom)) {
		throw new Error('A completed load without a list must stay empty.');
	}

	store.set(sourceNameAtom, 'ModsConfig.xml');
	if (!store.get(hasModListAtom)) {
		throw new Error('Loading a list must remain distinct from no list.');
	}

	const failedStore = createStore();
	failedStore.set(modListLoadStateAtom, 'failed');
	if (
		failedStore.get(modListLoadStateAtom) !== 'failed' ||
		failedStore.get(hasModListAtom)
	) {
		throw new Error('A failed load must not become a no-list result.');
	}
});
