import { basename, ResultBad } from "./utils";
export async function parseAPIUrl(url, modlinks, request) {
    const query = url.searchParams;
    const action = query.get('action')?.toLowerCase();
    const data = query.get('action_data');
    if (!action)
        return ResultBad();
    if (action == 'test') {
        return new Response("Hello, World!");
    }
    if (action == 'findmodwithfilename' && data) {
        return new Response(JSON.stringify(findModWithFileName(modlinks, data.split(',')), undefined, 4));
    }
    if (action == 'findmodwithfilesha' && data) {
        return new Response(JSON.stringify(findModWithFileSHA(modlinks, data.split(',')), undefined, 4));
    }
    return ResultBad();
}
export async function analyzeModLog(modlinks, request) {
    const ml = (await request.formData()).get('modlog');
    if (!ml)
        return ResultBad(502);
    const text = (await ml.text()).replaceAll('\r\n', '\n');
    const lines = text.split('\n');
    if (!lines.includes('[INFO]:[API] - Starting mod loading'))
        return ResultBad(503);
    let hkver = undefined;
    let apiver = undefined;
    const loadedMods = [];
    const duplicateMods = new Set();
    const index_flm = lines.indexOf('[INFO]:[API] - Finished loading mods:') + 1;
    if (index_flm != 0) {
        for (let i = index_flm; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line == '[INFO]:[API] -')
                break;
            const parts = line.substring(15).trim().split(':').map(x => x.trim());
            if (parts[1] == 'Failed to load! Duplicate mod detected') {
                duplicateMods.add(parts[0]);
            }
            else {
                if (parts[0] == "Modding API") {
                    const av = parts[1].split('-');
                    hkver = av[0];
                    apiver = Number.parseInt(av[1]);
                }
                loadedMods.push([parts[0], parts[1]]);
            }
        }
    }
    const missingMod = new Set();
    for (const fnf of text.matchAll(/FileNotFoundException: Could not load file or assembly '([A-Za-z0-9,. =\s]+)'/ig)) {
        const asmName = fnf[1].split(',')[0];
        const mods = findModWithFileName(modlinks, [asmName + ".dll"]);
        if (mods.length == 0)
            continue;
        console.log(mods[0].name);
        missingMod.add(mods[0].name);
    }
    const searchNP = new Set();
    for (const mm of text.matchAll(/MissingMethodException: ([\S]+) ([A-Za-z0-9_]+)./ig)) {
        const asmName = mm[2].split(',')[0];
        if (searchNP.has(asmName))
            continue;
        searchNP.add(asmName);
        const mods = findModWithFileName(modlinks, [asmName + ".dll"]);
        if (mods.length == 0)
            continue;
        missingMod.add(mods[0].name);
    }
    for (const mf of text.matchAll(/MissingFieldException: ([\S]+) ([A-Za-z0-9_]+)./ig)) {
        const asmName = mf[2].split(',')[0];
        if (searchNP.has(asmName))
            continue;
        searchNP.add(asmName);
        const mods = findModWithFileName(modlinks, [asmName + ".dll"]);
        if (mods.length == 0)
            continue;
        missingMod.add(mods[0].name);
    }
    return new Response(JSON.stringify({
        loadedMods,
        duplicateMods: [...duplicateMods],
        missingMod: [...missingMod],
        hkver,
        apiver
    }, undefined, 4));
}
export function findModWithFileSHA(modlinks, sha) {
    const result = new Set();
    for (const modName in modlinks.mods) {
        const mod = modlinks.mods[modName];
        for (const ver in mod) {
            const v = mod[ver];
            if (!v.ei_files?.files)
                continue;
            const msha = Object.values(v.ei_files.files);
            let u = true;
            for (const s of sha) {
                if (!msha.includes(s)) {
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
export function findModWithFileName(modlinks, files) {
    const result = new Set();
    for (const modName in modlinks.mods) {
        const mod = modlinks.mods[modName];
        for (const ver in mod) {
            const v = mod[ver];
            if (!v.ei_files?.files)
                continue;
            const mfiles = Object.keys(v.ei_files.files).map(x => basename(x));
            let u = true;
            for (const iterator of files) {
                if (!mfiles.includes(iterator)) {
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
