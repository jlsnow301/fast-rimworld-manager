import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ModHighlightState } from '@/utils/types';
import type { ModListType } from '@/utils/types';
import { createActiveModDiagnostics } from '@/utils/mod_highlights';
import { filterVisibleMods } from '@/utils/mod_search';
import { moveModBetweenLists } from '@/utils/mod_lists';
import { normalizedPackageId } from '@/utils/mods';
import { TEST_MOD_LIST } from '@/utils/test_mod_list';
import { ModList } from '@/features/mod-list/components/mod-list';
import { ModListRow } from '@/features/mod-list/components/mod-list-row';

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

type RenderedColor = {
	red: number;
	green: number;
	blue: number;
	hue: number;
	saturation: number;
};

function getRenderedColor(
	element: Element | null,
	ownerDocument: Document,
): RenderedColor | null {
	if (!element) return null;
	const computedColor = ownerDocument.defaultView?.getComputedStyle(element)
		.color;
	if (!computedColor) return null;
	const canvas = ownerDocument.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) return null;
	context.fillStyle = computedColor;
	context.fillRect(0, 0, 1, 1);
	const [redByte, greenByte, blueByte] = context.getImageData(0, 0, 1, 1)
		.data;
	const red = redByte / 255;
	const green = greenByte / 255;
	const blue = blueByte / 255;
	const maximum = Math.max(red, green, blue);
	const minimum = Math.min(red, green, blue);
	const difference = maximum - minimum;
	const lightness = (maximum + minimum) / 2;
	let hue = 0;
	if (difference > 0) {
		if (maximum === red) {
			hue = 60 * (((green - blue) / difference) % 6);
		} else if (maximum === green) {
			hue = 60 * ((blue - red) / difference + 2);
		} else {
			hue = 60 * ((red - green) / difference + 4);
		}
	}
	return {
		red: redByte,
		green: greenByte,
		blue: blueByte,
		hue: (hue + 360) % 360,
		saturation: difference === 0
			? 0
			: difference / (1 - Math.abs(2 * lightness - 1)),
	};
}

function isYellow(color: RenderedColor | null) {
	return color !== null && color.hue >= 30 && color.hue <= 90 &&
		color.saturation >= 0.4;
}

function isRed(color: RenderedColor | null) {
	return color !== null && (color.hue <= 20 || color.hue >= 340) &&
		color.saturation >= 0.4;
}

function sameRenderedColor(
	first: RenderedColor | null,
	second: RenderedColor | null,
) {
	return first !== null && second !== null && first.red === second.red &&
		first.green === second.green && first.blue === second.blue;
}

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
	const [filterActiveWarnings, setFilterActiveWarnings] = useState(false);
	const [filterInactiveWarnings, setFilterInactiveWarnings] = useState(false);
	const [filterActiveErrors, setFilterActiveErrors] = useState(false);
	const [filterInactiveErrors, setFilterInactiveErrors] = useState(false);
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
		{
			dimNonMatchingMods: dimActiveNonMatching,
			filterWarnings: filterActiveWarnings,
			filterErrors: filterActiveErrors,
			diagnosticsByPackageId: activeDiagnostics.byPackageId,
		},
	);
	const visibleInactiveMods = filterVisibleMods(
		inactiveMods,
		modDetailsByPackageId,
		inactiveSearch,
		{
			dimNonMatchingMods: dimInactiveNonMatching,
			filterWarnings: filterInactiveWarnings,
			filterErrors: filterInactiveErrors,
			diagnosticsByPackageId: activeDiagnostics.byPackageId,
		},
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
				filterWarnings={filterInactiveWarnings}
				filterErrors={filterInactiveErrors}
				isLoading={false}
				emptyMessage='No inactive sample mods.'
				mods={visibleInactiveMods}
				activeDiagnosticsByPackageId={activeDiagnostics.byPackageId}
				outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
				modDetailsByPackageId={modDetailsByPackageId}
				onDimNonMatchingModsChange={setDimInactiveNonMatching}
				onFilterWarningsChange={setFilterInactiveWarnings}
				onFilterErrorsChange={setFilterInactiveErrors}
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
				filterWarnings={filterActiveWarnings}
				filterErrors={filterActiveErrors}
				isLoading={false}
				emptyMessage='No active sample mods.'
				mods={visibleActiveMods}
				activeDiagnosticsByPackageId={activeDiagnostics.byPackageId}
				outdatedWorkshopModsByPackageId={outdatedWorkshopModsByPackageId}
				modDetailsByPackageId={modDetailsByPackageId}
				onDimNonMatchingModsChange={setDimActiveNonMatching}
				onFilterWarningsChange={setFilterActiveWarnings}
				onFilterErrorsChange={setFilterActiveErrors}
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
	play: ({ canvasElement }) => {
		const ownerDocument = canvasElement.ownerDocument;
		const root = ownerDocument.documentElement;
		const originalDarkMode = root.classList.contains('dark');
		try {
			for (const darkMode of [false, true]) {
				root.classList.toggle('dark', darkMode);
				for (const type of ['inactive', 'active']) {
					const warningIcon = canvasElement.querySelector(
						`button[aria-label="Toggle warning filter for ${type} mods"] svg.lucide-triangle-alert`,
					);
					const errorIcon = canvasElement.querySelector(
						`button[aria-label="Toggle error filter for ${type} mods"] svg.lucide-circle-alert`,
					);
					if (
						!isYellow(
							getRenderedColor(warningIcon, ownerDocument),
						) ||
						!isRed(getRenderedColor(errorIcon, ownerDocument))
					) {
						throw new Error(
							`${type} filter icons must render warning yellow and error red in ${
								darkMode ? 'dark' : 'light'
							} mode.`,
						);
					}
				}
			}
		} finally {
			root.classList.toggle('dark', originalDarkMode);
		}
	},
};

const warningDiagnostics: ModHighlightState = {
	errors: [],
	warnings: [{
		code: 'load-order',
		severity: 'warning',
		title: 'Load order violation',
		details: ['The warning mod is out of order.'],
	}],
};
const errorDiagnostics: ModHighlightState = {
	errors: [{
		code: 'missing-dependency',
		severity: 'error',
		title: 'Missing dependencies',
		details: ['The error mod is missing a dependency.'],
	}],
	warnings: [],
};
const combinedDiagnostics: ModHighlightState = {
	errors: errorDiagnostics.errors,
	warnings: warningDiagnostics.warnings,
};

function SeverityColorsDemo() {
	const rows = [
		{
			packageId: 'sample.warning',
			index: 0,
			isMatch: true,
			name: 'Warning-only mod',
			diagnostics: warningDiagnostics,
		},
		{
			packageId: 'sample.error',
			index: 1,
			isMatch: true,
			name: 'Error-only mod',
			diagnostics: errorDiagnostics,
		},
		{
			packageId: 'sample.combined',
			index: 2,
			isMatch: true,
			name: 'Combined-severity mod',
			diagnostics: combinedDiagnostics,
		},
	];

	return (
		<div className='flex w-96 flex-col border'>
			{rows.map((data) => (
				<ModListRow
					data={data}
					key={data.packageId}
					onSelectMod={() => {}}
					type='inactive'
				/>
			))}
		</div>
	);
}

export const SeverityColors: Story = {
	render: () => <SeverityColorsDemo />,
	play: ({ canvasElement }) => {
		const ownerDocument = canvasElement.ownerDocument;
		const root = ownerDocument.documentElement;
		const originalDarkMode = root.classList.contains('dark');
		const warningRow = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label^="Show details for Warning-only mod"]',
		);
		const errorRow = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label^="Show details for Error-only mod"]',
		);
		const combinedRow = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-label^="Show details for Combined-severity mod"]',
		);
		const warningName = warningRow?.querySelector('.truncate') ?? null;
		const errorName = errorRow?.querySelector('.truncate') ?? null;
		const combinedName = combinedRow?.querySelector('.truncate') ?? null;
		const warningIcon = warningRow?.querySelector(
			'svg.lucide-triangle-alert',
		) ?? null;
		const errorIcon = errorRow?.querySelector(
			'svg.lucide-circle-alert',
		) ?? null;
		const combinedWarningIcon = combinedRow?.querySelector(
			'svg.lucide-triangle-alert',
		) ?? null;
		const combinedErrorIcon = combinedRow?.querySelector(
			'svg.lucide-circle-alert',
		) ?? null;

		try {
			for (const darkMode of [false, true]) {
				root.classList.toggle('dark', darkMode);
				const warningNameColor = getRenderedColor(
					warningName,
					ownerDocument,
				);
				const errorNameColor = getRenderedColor(
					errorName,
					ownerDocument,
				);
				const combinedNameColor = getRenderedColor(
					combinedName,
					ownerDocument,
				);
				const warningIconColor = getRenderedColor(
					warningIcon,
					ownerDocument,
				);
				const errorIconColor = getRenderedColor(
					errorIcon,
					ownerDocument,
				);
				const combinedWarningColor = getRenderedColor(
					combinedWarningIcon,
					ownerDocument,
				);
				const combinedErrorColor = getRenderedColor(
					combinedErrorIcon,
					ownerDocument,
				);
				if (
					!isYellow(warningNameColor) ||
					!sameRenderedColor(warningNameColor, warningIconColor) ||
					!isRed(errorNameColor) ||
					!sameRenderedColor(errorNameColor, errorIconColor) ||
					!isRed(combinedNameColor) ||
					!sameRenderedColor(combinedNameColor, errorNameColor) ||
					!isYellow(combinedWarningColor) ||
					!sameRenderedColor(
						combinedWarningColor,
						warningIconColor,
					) ||
					!sameRenderedColor(combinedErrorColor, errorNameColor)
				) {
					throw new Error(
						`Warning text/icons must render yellow, error text/icons red, and combined rows must keep error precedence in ${
							darkMode ? 'dark' : 'light'
						} mode.`,
					);
				}
			}
		} finally {
			root.classList.toggle('dark', originalDarkMode);
		}
	},
};
