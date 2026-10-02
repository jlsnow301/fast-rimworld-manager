export type PathSettings = {
	gamePath: string;
	configPath: string;
	localModsPath: string;
	workshopPath: string;
};

export type ImportedModListFile = {
	fileName: string;
	contents: string;
};
export type DatabaseKind =
	| 'communityRules'
	| 'steamWorkshop'
	| 'noVersionWarning';

export type DatabaseDownloadResult = {
	database: DatabaseKind;
	bytesDownloaded: number;
	lastModified: number;
};

export type DatabaseFileStatus = {
	database: DatabaseKind;
	lastModified: number | null;
};

export type DetectedPaths = {
	gamePath: string | null;
	configPath: string | null;
	localModsPath: string | null;
	workshopPath: string | null;
};

type ModDependency = {
	packageId: string;
	name: string;
	alternativePackageIds: string[];
};

export type InstalledMod = {
	name: string;
	author: string | null;
	packageId: string;
	description: string;
	publishedFileId: string | null;
	loadAfter: string[];
	loadBefore: string[];
	incompatibleWith: string[];
	supportedVersions: string[];
	versionWarningSilenced: boolean;
	path: string;
	source: string;
	dependencies: ModDependency[];
};

export type ModIssueCode =
	| 'missing-mod'
	| 'duplicate-mod'
	| 'missing-dependency'
	| 'incompatibility'
	| 'load-order'
	| 'version-mismatch';

export type ModIssueSeverity = 'error' | 'warning';

export type ModIssue = {
	code: ModIssueCode;
	severity: ModIssueSeverity;
	title: string;
	details: string[];
};

export type ModHighlightState = {
	errors: ModIssue[];
	warnings: ModIssue[];
};

export type ActiveModDiagnostics = {
	byPackageId: ReadonlyMap<string, ModHighlightState>;
	errorCount: number;
	warningCount: number;
};

export type SteamModPreview = {
	publishedFileId: string;
	title: string;
	description: string;
	previewUrl: string | null;
	timeUpdated: number | null;
};

export type OutdatedWorkshopMod = {
	name: string;
	packageId: string;
	publishedFileId: string;
	installedTimeUpdated: number;
	steamTimeUpdated: number;
};

export type WorkshopUpdateCheckResult = {
	checkedCount: number;
	skippedCount: number;
	outdatedMods: OutdatedWorkshopMod[];
};

export type WorkshopUpdateDispatchResult = {
	openedCount: number;
	failedCount: number;
};

export type ModListType = 'active' | 'inactive';

export type ModListFile = {
	activeMods: string[];
	knownExpansions: string[];
	version: string;
};

export type VisibleMod = {
	packageId: string;
	index: number;
	isMatch: boolean;
};

export type PathField = {
	key: keyof PathSettings;
	label: string;
};
