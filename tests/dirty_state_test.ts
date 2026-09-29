import {
	createModListSnapshot,
	hasModListChanges,
} from '@/utils/dirty_state.ts';

Deno.test('loaded list matches its saved snapshot', () => {
	const saved = createModListSnapshot('1.6', ['Core', 'Author.Mod'], [
		'Core',
	]);
	const current = createModListSnapshot('1.6', ['Core', 'Author.Mod'], [
		'Core',
	]);

	if (hasModListChanges(saved, current)) {
		throw new Error('Unchanged loaded lists should be clean.');
	}
});

Deno.test('active order, version, and expansions changes mark list dirty', () => {
	const saved = createModListSnapshot('1.6', ['Core', 'Author.Mod'], [
		'Core',
	]);
	const changedOrder = createModListSnapshot('1.6', ['Author.Mod', 'Core'], [
		'Core',
	]);
	const changedVersion = createModListSnapshot(
		'1.5',
		['Core', 'Author.Mod'],
		[
			'Core',
		],
	);
	const changedExpansions = createModListSnapshot(
		'1.6',
		['Core', 'Author.Mod'],
		[],
	);

	if (
		!hasModListChanges(saved, changedOrder) ||
		!hasModListChanges(saved, changedVersion) ||
		!hasModListChanges(saved, changedExpansions)
	) {
		throw new Error(
			'Each persisted ModsConfig field should participate in dirty state.',
		);
	}
});

Deno.test('restoring and saving a mod snapshot clears dirty state', () => {
	const saved = createModListSnapshot('1.6', ['Core', 'Author.Mod'], [
		'Core',
	]);
	const removed = createModListSnapshot('1.6', ['Core'], ['Core']);
	const restored = createModListSnapshot('1.6', ['Core', 'Author.Mod'], [
		'Core',
	]);

	if (!hasModListChanges(saved, removed)) {
		throw new Error('Removing an active mod should mark the list dirty.');
	}
	if (hasModListChanges(saved, restored)) {
		throw new Error(
			'Restoring the saved mod order should clear dirty state.',
		);
	}

	const savedAfterWrite = createModListSnapshot(
		removed.version,
		removed.activeMods,
		removed.knownExpansions,
	);
	if (hasModListChanges(savedAfterWrite, removed)) {
		throw new Error('The successfully saved contents should become clean.');
	}
	if (!hasModListChanges(savedAfterWrite, saved)) {
		throw new Error(
			'The old saved list should be dirty after a new list is saved.',
		);
	}
});
