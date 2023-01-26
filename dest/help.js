import { ForwardMessage } from "oicq";
import * as fs from "fs-extra";
import { existsSync, readFileSync } from "fs";
export const analyzeModLogSteps = [];
export function convertHelp(msg, uin) {
    return msg.map(x => {
        return {
            message: x.message.filter(x => x.type != 'xml' && x.type != 'json'),
            user_id: uin,
            nickname: "帮助",
            group_id: undefined
        };
    }).filter(x => x.message.length > 0);
}
export async function saveHelp(client, group, msg, name) {
    const xg = await client.makeForwardMsg(convertHelp(msg, client.uin));
    await group.sendMsg(xg);
    fs.outputJSONSync(`./helps/${name}.json`, JSON.stringify(msg.map(x => x.serialize())));
}
export async function printHelp(group, name) {
    if (!existsSync(`./helps/${name}.json`))
        return;
    console.log(fs);
    const xg = await group.client.makeForwardMsg(convertHelp(JSON.parse(readFileSync(`./helps/${name}.json`, 'utf-8')).map(x => ForwardMessage.deserialize(x)), group.client.uin));
    await group.sendMsg(xg);
}
