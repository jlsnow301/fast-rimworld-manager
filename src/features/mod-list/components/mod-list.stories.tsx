import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ModListType } from '@/utils/types';
import { createActiveModDiagnostics } from '@/utils/mod_highlights';
import { filterVisibleMods } from '@/utils/mod_search';
import { moveModBetweenLists } from '@/utils/mod_lists';
import { normalizedPackageId } from '@/utils/mods';
import { TEST_MOD_LIST } from '@/utils/test_mod_list';
import { ModList } from '@/features/mod-list/components/mod-list';

const modDetailsByPackageId = new Map(
	TEST_MOD_LIST.installedMods.map((mod) => [
		normalizedPackageId(mod.packageId),
		mod,
	]),
);
const outdatedWorkshopModsByPackageId = new Map(
	TEST_MOD_LIST.updateCheckResult.outdatedMods.map((mod) => [
		normalizedPackageId(mod.packageId),
		mod,
	]),
);

function ModListDemo() {
	const [activeMods, setActiveMods] = useState<string[]>([
		...TEST_MOD_LIST.modList.activeMods,
	]);
	const [inactiveMods, setInactiveMods] = useState<string[]>(() =>
		TEST_MOD_LIST.installedMods
			.filter((mod) =>
				!TEST_MOD_LIST.modList.activeMods.includes(mod.packageId)
			)
			.map((mod) => mod.packageId)
	);
	const [activeSearch, setActiveSearch] = useState('');
	const [inactiveSearch, setInactiveSearch] = useState('');
	const [dimActiveNonMatching, setDimActiveNonMatching] = useState(false);
	const [dimInactiveNonMatching, setDimInactiveNonMatching] = useState(false);
	const [selectedPackageId, setSelectedPackageId] = useState('');
	const activeDiagnostics = createActiveModDiagnostics(
		activeMods,
		modDetailsByPackageId,
		TEST_MOD_LIST.modList.version,
	);
	const visibleActiveMods = filterVisibleMods(
		activeMods,
		modDetailsByPackageId,
		activeSearch,
		dimActiveNonMatching,
	);
	const visibleInactiveMods = filterVisibleMods(
		inactiveMods,
		modDetailsByPackageId,
		inactiveSearch,
		dimInactiveNonMatching,
	);

	function handleDropMod(
		sourceIndex: number,
		source: ModListType,
		target: ModListType,
	) {
		if (source === target) return;
		const transfer = moveModBetweenLists(
			activeMods,
			inactiveMods,
			sourceIndex,
			source,
		);
		if (!transfer) return;
		setActiveMods(transfer.active);
		setInactiveMods(transfer.inactive);
	}

	return (
		<div className='grid h-dvh min-h-0 grid-cols-2 gap-4 overflow-hidden p-6'>
			<ModList
				count={inactiveMods.length}
				dimNonMatchingMods={dimInactiveNonMatching}
				isLoading={false}
				emptyMessage='No inactive sample mods.'
				mods={visibleInactiveMods}
				activeDiagnosticsByPackageId={activeDiagnostics.byPackageId}
				outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
				modDetailsByPackageId={modDetailsByPackageId}
				onDimNonMatchingModsChange={setDimInactiveNonMatching}
				onSearchChange={setInactiveSearch}
				onDropMod={handleDropMod}
				onSelectMod={setSelectedPackageId}
				searchValue={inactiveSearch}
				title='Inactive mods'
				type='inactive'
			/>
			<ModList
				count={activeMods.length}
				dimNonMatchingMods={dimActiveNonMatching}
				isLoading={false}
				emptyMessage='No active sample mods.'
				mods={visibleActiveMods}
				activeDiagnosticsByPackageId={activeDiagnostics.byPackageId}
				outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
				modDetailsByPackageId={modDetailsByPackageId}
				onDimNonMatchingModsChange={setDimActiveNonMatching}
				onSearchChange={setActiveSearch}
				onDropMod={handleDropMod}
				onSelectMod={setSelectedPackageId}
				searchValue={activeSearch}
				title='Active mods'
				type='active'
			/>
			<span aria-live='polite' className='sr-only'>
				{selectedPackageId
					? `Selected ${
						modDetailsByPackageId.get(
							normalizedPackageId(selectedPackageId),
						)?.name ?? selectedPackageId
					}`
					: ''}
			</span>
		</div>
	);
}

const meta = {
	title: 'Mod Lists/ModList',
	component: ModListDemo,
	parameters: { layout: 'fullscreen' },
	tags: ['autodocs'],
} satisfies Meta<typeof ModListDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveAndInactive: Story = {
	render: () => <ModListDemo />,
};
