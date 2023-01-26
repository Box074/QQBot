
export interface ModFileRecord {
    files?: Record<string, string>;
    link: string;
    size?: number;
    noSource?: boolean;
    sha256?: string;
}

export type ModTag = "Boss" | "Cosmetic" | "Expansion" | "Gameplay" | "Library" | "Utility";

export let currentPlatform: string = "Windows";

export interface ModCollection {
    mods: Record<string, ModVersionCollection>;
    latestCommit?: string;
    lastUpdate?: number;
}

export type ModVersionCollection = Record<string, ModLinksManifestData>;

export interface ModLinksManifestData {
    name: string;
    desc: string;
    version: string;
    link?: string;
    dependencies: string[];
    repository: string | undefined;
    integrations: string[];
    tags: ModTag[];
    authors: string[];
    date?: string;
    isDeleted?: boolean;

    ei_files?: ModFileRecord;
}

export class ModLinksData {
    mods: ModLinksManifestData[] = [];
}