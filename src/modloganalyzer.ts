import { basename } from "path";
import { ModCollection, ModLinksManifestData, ModVersionCollection } from "./types";
import axios from "axios";
import { FileElem, Forwardable, GroupMessageEvent } from "oicq";


let modlinksCache: Record<string, ModLinksManifestData> = undefined as any;
let origModLinks: ModCollection = undefined as any;

export async function getModLinks() {
    if (origModLinks && modlinksCache) return modlinksCache;
    origModLinks = (await axios.get<ModCollection>("https://github.com/HKLab/modlinks-archive/raw/master/modlinks.json")).data;
    modlinksCache = {};
    for (const v of Object.values(origModLinks.mods)
        .map(x => getLatestMod(x))) {
        modlinksCache[v.name] = v;
    }
    return modlinksCache;
}


export async function oicq_beginAnalyze(ev: GroupMessageEvent, file: FileElem) {
    const bot = ev.group.client;
    if (file.size > 1024 * 1024 * 2) {
        ev.reply("文件过大", true);
        return;
    }
    const ml = await getModLinks();
    const furl = await ev.group.getFileUrl(file.fid);
    const fd = (await axios.get<string>(furl, {
        responseType: 'text'
    })).data;
    const result = await analyzeModLog(origModLinks, fd);
    const resultText: Forwardable[] = [];
    const advices: Forwardable[] = [];
    if (result.missingMod.length > 0) {
        resultText.push({
            user_id: bot.uin,
            nickname: "分析结果 - 缺失的Mods",
            message: result.missingMod.join('\n')
        });
        for (const mod of result.missingMod) {
            advices.push({
                user_id: bot.uin,
                nickname: "分析结果 - 建议",
                message: `安装缺失的Mod: ${mod}
下载地址：https://ghproxy.net/${ml[mod].link}
`
            });
        }
    }
    if (result.loadedMods.length > 0) {
        resultText.push({
            user_id: bot.uin,
            nickname: "分析结果 - 已加载的Mods",
            message: result.loadedMods.map(x => x.join(': ')).join('\n')
        });
    }
    if (result.duplicateMods.length > 0) {
        resultText.push({
            user_id: bot.uin,
            nickname: "分析结果 - 重复加载的Mods",
            message: result.duplicateMods.join('\n')
        });
        for (const mod of result.missingMod) {
            advices.push({
                user_id: bot.uin,
                nickname: "分析结果 - 建议",
                message: `删除重复的Mod: ${mod}`
            });
        }
    }
    if (result.requireUpdateMods.length > 0) {
        resultText.push({
            user_id: bot.uin,
            nickname: "分析结果 - 需要更新的Mods",
            message: result.duplicateMods.join('\n')
        });
        for (const mod of result.requireUpdateMods) {
            advices.push({
                user_id: bot.uin,
                nickname: "分析结果 - 建议",
                message: `更新Mod至最新版本: ${mod}
下载地址：https://ghproxy.net/${ml[mod].link}
`
            });
        }
    }

    ev.reply(await bot.makeForwardMsg([...advices, ...resultText]));
}

export async function analyzeModLog(modlinks: ModCollection, text: string) {
    text = text.replaceAll('\r\n', '\n');
    const lines = text.split('\n');
    if (!lines.includes('[INFO]:[API] - Starting mod loading')) throw new Error("无效的ModLog.txt");
    let hkVer: string | undefined = undefined;
    let apiVer: number | undefined = undefined;
    const loadedMods: [string, string][] = [];
    const duplicateMods = new Set<string>();
    const index_flm = lines.indexOf('[INFO]:[API] - Finished loading mods:') + 1;
    if (index_flm != 0) {
        for (let i = index_flm; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line == '[INFO]:[API] -') break;
            const parts = line.substring(15).trim().split(':').map(x => x.trim());
            if (parts[1] == 'Failed to load! Duplicate mod detected') {
                duplicateMods.add(parts[0]);
            } else {
                if (parts[0] == "Modding API") {
                    const av = parts[1].split('-');
                    hkVer = av[0];
                    apiVer = Number.parseInt(av[1]);
                }
                loadedMods.push([parts[0], parts[1]]);
            }
        }
    }
    const missingMod = new Set<string>();
    for (const fnf of text.matchAll(/FileNotFoundException: Could not load file or assembly '([A-Za-z0-9,. =\s]+)'/ig)) {
        const asmName = fnf[1].split(',')[0];
        const mods = findModWithFileName(modlinks, [asmName + ".dll"]);
        if (mods.length == 0) continue;
        console.log(mods[0].name);
        missingMod.add(mods[0].name);
    }
    const searchNP = new Set<string>();
    for (const mm of text.matchAll(/MissingMethodException: ([\S]+) ([A-Za-z0-9_]+)./ig)) {
        const asmName = mm[2].split(',')[0];
        if (searchNP.has(asmName)) continue;
        searchNP.add(asmName);
        const mods = findModWithFileName(modlinks, [asmName + ".dll"]);
        if (mods.length == 0) continue;
        missingMod.add(mods[0].name);
    }
    for (const mf of text.matchAll(/MissingFieldException: ([\S]+) ([A-Za-z0-9_]+)./ig)) {
        const asmName = mf[2].split(',')[0];
        if (searchNP.has(asmName)) continue;
        searchNP.add(asmName);
        const mods = findModWithFileName(modlinks, [asmName + ".dll"]);
        if (mods.length == 0) continue;
        missingMod.add(mods[0].name);
    }
    const requireUpdateMods = new Set<string>();
    const lms = loadedMods.map(x => x[0].replaceAll(' ', '').toLowerCase());
    for (const mod of [...missingMod]) {
        if (lms.includes(mod.replaceAll(' ', '').toLowerCase())) {
            missingMod.delete(mod);
            requireUpdateMods.add(mod);
        }
    }
    return {
        loadedMods,
        duplicateMods: [...duplicateMods],
        missingMod: [...missingMod],
        requireUpdateMods: [...requireUpdateMods],
        hkVer,
        apiVer
    };
}

export function findModWithFileSHA(modlinks: ModCollection, sha: string[]) {
    const result = new Set<ModLinksManifestData>();
    for (const modName in modlinks.mods) {
        const mod = modlinks.mods[modName];
        for (const ver in mod) {
            const v = mod[ver];
            if (!v.ei_files?.files) continue;
            const modSHA = Object.values(v.ei_files.files);
            let u = true;
            for (const s of sha) {
                if (!modSHA.includes(s)) {
                    u = false;
                    break;
                }
            }
            if (u) {
                result.add(v);
            }
        }
    }
    return [...result.values()];
}

export function findModWithFileName(modlinks: ModCollection, files: string[]) {
    const result = new Set<ModLinksManifestData>();
    for (const modName in modlinks.mods) {
        const mod = modlinks.mods[modName];
        for (const ver in mod) {
            const v = mod[ver];
            if (!v.ei_files?.files) continue;
            const modFiles = Object.keys(v.ei_files.files).map(x => basename(x));
            let u = true;
            for (const iterator of files) {
                if (!modFiles.includes(iterator)) {
                    u = false;
                    break;
                }
            }
            if (u) {
                result.add(v);
            }
        }
    }
    return [...result.values()];
}

export function isLaterVersion(a: string, b: string) {
    const aPart = a.split('.');
    const bPart = b.split('.');
    for (let i = 0; i < aPart.length; i++) {
        if (i >= bPart.length) return true;
        const va = Number.parseInt(aPart[i]);
        const vb = Number.parseInt(bPart[i]);
        if (va > vb) return true;
        else if (va < vb) return false;
    }
    return false;
}

export function getLatestMod(mod: ModVersionCollection) {
    const ver = Object.values(mod);
    let latest = ver[0];
    for (const v of ver) {
        if (isLaterVersion(v.version, latest.version)) {
            latest = v;
        }
    }
    return latest;
}
