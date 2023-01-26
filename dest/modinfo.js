import { getLatestMod, getModLinks } from "./modloganalyzer.js";
export async function printModInfo(group, name) {
    const ml = await getModLinks();
    name = name.trim();
    const vc = ml.mods[name.trim()];
    if (!vc) {
        group.sendMsg("未找到mod: " + name);
        return;
    }
    let lv = getLatestMod(vc);
    const uin = group.client.uin;
    await group.sendMsg(await group.client.makeForwardMsg([
        {
            user_id: uin,
            nickname: "Mod信息",
            message: `Mod名称：${name}
版本号：${lv.version}
最近更新：${getModDate(lv.date).toLocaleString()}
大小：${ConvertSize(lv.ei_files?.size ?? 0)}
仓库地址：${lv.repository}
下载地址：https://ghrpoxy.net/${lv.link}
SHA256: ${lv.ei_files?.sha256}
`
        },
        {
            user_id: uin,
            nickname: "Mod描述",
            message: lv.desc
        },
        {
            user_id: uin,
            nickname: "依赖Mods",
            message: lv.dependencies.length > 0 ? lv.dependencies.join('\n') : '（无）'
        }
    ]));
}
export function getModDate(date) {
    const parts = date.split('T');
    const day = parts[0].split('-');
    const time = parts[1].replaceAll('Z', '').split(':');
    const d = new Date(Number.parseInt(day[0]), Number.parseInt(day[1]) - 1, Number.parseInt(day[2]), Number.parseInt(time[0]), Number.parseInt(time[1]), Number.parseInt(time[2]));
    return d;
}
export function ConvertSize(bytes) {
    if (!bytes)
        return "0 KB";
    if (bytes > 1024 * 1024 * 1024)
        return `${Math.round(bytes / 1024 / 1024 / 1024)} G`;
    if (bytes > 1024 * 1024)
        return `${Math.round(bytes / 1024 / 1024)} MB`;
    if (bytes > 1024)
        return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
}
