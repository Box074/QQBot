import { Client, Forwardable, Group, GroupMessageEvent } from "oicq";

export async function createQA(client: Client, watchUID: number, group: Group, selections: [string, (group: Group) => void][],
    title: string, desc?: string, single = true) {
    const msg: Forwardable[] = [];
    selections = [...selections];
    msg.push({
        user_id: client.uin,
        nickname: title,
        message: "30秒内回复编号查看，例如'#0'"
    })
    if (desc) {
        msg.push({
            user_id: client.uin,
            nickname: title,
            message: desc
        });
    }
    const tr = single ? selections : [...selections];
    const c = (ev: GroupMessageEvent) => {
        if (ev.sender.user_id == watchUID && ev.group_id == group.group_id) {
            const rm = ev.raw_message.trim();
            if (ev.raw_message.startsWith('#')) {
                try {
                    const id = Number.parseInt(rm.substring(1));
                    if (id >= tr.length || id < 0) return;
                    tr[id][1](group);
                    client.off('message.group', c);
                } catch (e) {
                    client.logger.error(e);
                }
            }
        }
    };
    client.on('message.group', c);
    setTimeout(() => {
        client.off('message.group', c);
    }, 30 * 1000);

    if (single) {
        let index = 0;
        for (const sel of selections) {
            msg.push({
                user_id: client.uin,
                nickname: `#${index}`,
                message: sel[0]
            });
            index++;
        }
    } else {
        let index = 0;
        while (selections.length > 0) {
            const chunk = selections.splice(0, 20);
            const text = chunk.map((val, id) => {
                return `#${id + index}- ${val[0]}`;
            }).join('\n');
            msg.push({
                user_id: client.uin,
                nickname: `#${index}`,
                message: text
            });
            index += 20;
        }
    }
    return await group.sendMsg(await client.makeForwardMsg(msg));
}
