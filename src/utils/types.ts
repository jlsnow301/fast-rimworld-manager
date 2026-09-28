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
export type DatabaseKind = 'communityRules' | 'steamWorkshop';

export type DatabaseDownloadResult = {
	database: DatabaseKind;
	bytesDownloaded: number;
};

export type DetectedPaths = {
	gamePath: string | null;
	configPath: string | null;
	localModsPath: string | null;
	workshopPath: string | null;
};

export type InstalledMod = {
	name: string;
	packageId: string;
	description: string;
	publishedFileId: string | null;
	path: string;
	source: string;
};

export type SteamModPreview = {
	publishedFileId: string;
	title: string;
	description: string;
	previewUrl: string | null;
	timeUpdated: number | null;
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
};

export type PathField = {
	key: keyof PathSettings;
	label: string;
};
