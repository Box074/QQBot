import { readFileSync } from "fs";
import { Client, Forwardable, Group } from "oicq";
import { filterMods, prepareFilter, processingModName } from "./modfilter.js";
import { getLatestMod, getModLinks } from "./modloganalyzer.js";
import { createQA } from "./QA.js";
import { ModLinksManifestData, ModVersionCollection } from "./types.js";

export const modalias: Record<string, string> = JSON.parse(readFileSync("./chinese_modalias.json", 'utf8'));
export const moddesc: Record<string, string> = JSON.parse(readFileSync("./chinese_moddesc.json", 'utf8'));

export async function filterModNamesDefault(client: Client, name: string) {
    client.logger.info("Filter:" + name);
    const filter = prepareFilter(name, undefined, mod => modalias[processingModName(mod.name)]);
    const mods = filterMods(Object.values(await getModLinks()), filter);
    return mods.map(x => x.name);
}

export async function printAllMods(group: Group, sender: number, name?: string) {
    const ml = await getModLinks();
    let modNames = Object.keys(ml)
        .sort((a, b) => a.localeCompare(b));
    if (name) {
        modNames = await filterModNamesDefault(group.client, name);
    }
    return await createQA(group.client, sender, group, modNames.map(x => {
        const pn = processingModName(x);
        return [x + (modalias[pn] ? ` (${modalias[pn]})` : ''), () => {
            printModInfo(group, x);
        }]
    }), "Mods列表", undefined, false);
}

export async function printModInfo(group: Group, name: string | ModLinksManifestData) {
    if (typeof name == 'string') {
        const ml = await getModLinks();
        const pmn: Record<string, ModLinksManifestData> = {};
        const oname = name;
        for (const modName in ml) {
            const mn = processingModName(modName);
            pmn[mn] = ml[modName];
        }
        name = processingModName(name);
        let lv = pmn[name];
        if (!lv) {
            const fl = await filterModNamesDefault(group.client, oname);
            if (fl.length == 0) {
                group.sendMsg("未找到mod: " + oname);
                return;
            } else if (fl.length > 1) {
                group.sendMsg(`未找到mod: ${oname}
是否想寻找${fl[0]}?
输入 '#bot 筛选mods:${oname} '获得更多结果`)
                return;
            }
            lv = ml[fl[0]];
        }
        name = lv;
    }
    const uin = group.client.uin;
    const aname = name.name.toLowerCase().replaceAll(' ', '');
    await group.sendMsg(await group.client.makeForwardMsg([
        {
            user_id: uin,
            nickname: "Mod信息",
            message: `Mod名称：${name.name} (${modalias[aname] ? modalias[aname] : ""})
版本号：${name.version}
最近更新：${getModDate(name.date as string).toLocaleString()}
大小：${ConvertSize(name.ei_files?.size ?? 0)}
仓库地址：${name.repository}
下载地址：https://ghrpoxy.net/${name.link}
SHA256: ${name.ei_files?.sha256}
`
        },
        {
            user_id: uin,
            nickname: "Mod描述",
            message: name.desc + (moddesc[aname] ? ("\n\n" + moddesc[aname] + `

mod描述来自: https://docs.qq.com/sheet/DSm90dmtWUUhhUmpP?tab=BB08J2`) : "")
        },
        {
            user_id: uin,
            nickname: "依赖Mods",
            message: name.dependencies.length > 0 ? name.dependencies.join('\n') : '（无）'
        }
    ]));
}

export function getModDate(date: string) {
    const parts = date.split('T');
    const day = parts[0].split('-');
    const time = parts[1].replaceAll('Z', '').split(':');
    const d = new Date(Number.parseInt(day[0]), Number.parseInt(day[1]) - 1, Number.parseInt(day[2]),
        Number.parseInt(time[0]), Number.parseInt(time[1]), Number.parseInt(time[2])
    );
    return d;
}

export function ConvertSize(bytes: number) {
    if (!bytes) return "0 KB";
    if (bytes > 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024 / 1024)} G`;
    if (bytes > 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
    if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}
