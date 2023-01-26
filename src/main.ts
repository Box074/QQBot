
import { get } from "http";
import { readFileSync } from "fs";
import * as oicq from "oicq";
import { dirname, join } from "path";
import { createInterface } from "readline";
import { Platform } from "oicq";
import { oicq_beginAnalyze } from "./modloganalyzer.js";
import { writeFile } from "fs/promises";
import { printAllMods, printModInfo } from "./modinfo.js";
import { createQA } from "./QA.js";

export interface Config {
    qqNumber:   number;
    qqPassword: string;
    masterQQ:   number;
    watchQQ:    number[];
    watchGroup: number[];
    signGroup:  any[];
}


export const config: Config = JSON.parse(readFileSync("config.json", "utf-8"));
let signGroups: number[] = [];
let blacklist = new Set<number>();

const rl = createInterface(process.stdin, process.stdout);

rl.on('line', i => {
    if(i == 'stop') process.exit();
});

var client = oicq.createClient(config["qqNumber"], {
    platform: Platform.Android
});
client.on("system.login.qrcode", (data) => {
    client.logger.mark("扫码登陆");
    console.log("扫码后Enter");
    process.stdin.once("data", () => {
        client.login();
    });
});

client.on("system.login.device", (data) => {
    client.logger.mark("输入密保手机收到的短信验证码后按下回车键继续。");
    client.sendSmsCode();
    rl.question("sms?", sms => {
        client.submitSmsCode(sms);
    });
});

client.on("system.login.slider", (data) => {
    console.log("滑动验证：" + data.url);
    rl.question("ticket?", ticket => {
        client.submitSlider(ticket);
    });
});

client.on("request.group.add", (ev) => {
    if(config.watchGroup.includes(ev.group_id)) {
        if(blacklist.has(ev.user_id)) {
            client.setGroupAddRequest(ev.flag, false, "黑名单");
        }
    }
});

if(process.env.USE_QRCODE) {
    client.login();
} else {
    client.login(config["qqPassword"]);
}

//

client.on("message.group", async (ev) => {
    try {
        const at = ev.message.filter(x => x.type == 'at') as oicq.AtElem[];
        let atMe = at.filter(x => x.qq != 'all' && (x.qq == client.uin || config["watchQQ"].includes(x.qq))).length > 0;
        let text = ev.message.filter(x => x.type == 'text').map(x => (x as oicq.TextElem).text).join('').trim();
        if(text.startsWith("#bot")) {
            text = text.substring("#bot".length).trim();
            atMe = true;
        }
        if (atMe) {
            client.logger.info(text);
            if (ev.source) {
                const source = (await ev.group.getChatHistory(ev.source.seq, 1))[0];
                if (source) {
                    if (text == "获取代码") {
                        const m = source.message[0];
                        if (m.type == 'xml' || m.type == 'json') {
                            ev.reply(m.data?.toString());
                        }
                        return;
                    }
                    if (text.toLowerCase() == "getcode") {
                        ev.reply(await client.makeForwardMsg(source.message.map(x => {
                            return {
                                user_id: client.uin,
                                message: JSON.stringify(x, undefined, 4)
                            }
                        })));
                        return;
                    }
                    const file = source.message.filter(x => x.type == 'file')[0] as oicq.FileElem;
                    if (file) {
                        if (text.toLowerCase() == "分析modlog") {
                            await oicq_beginAnalyze(ev, file);
                        }
                        if (text.toLowerCase() == "获取链接") {
                            ev.reply(await ev.group.getFileUrl(file.fid), true);
                        }
                    }
                }
            } else {
                if (ev.sender.user_id == config.masterQQ) {
                    if (text.toLowerCase() == "restart") {
                        process.exit(0);
                    } else if (text.toLowerCase() == "stop") {
                        process.exit(100);
                    } else if(text.toLowerCase() == "check") {
                        ev.reply("Running", true);
                        return;
                    } else if(text.startsWith("黑名单")) {
                        const qq = text.substring("黑名单".length).trim();
                        blacklist.add(Number.parseInt(qq));
                    } else if(text == "Test") {
                        await createQA(client, ev.sender.user_id, ev.group,[
                            ["Test1", () => ev.reply("Test1")],
                            ["Test2", () => ev.reply("Test2")],
                            ["Test3", () => ev.reply("Test3")]
                        ], "123", undefined, true);
                    }
                }
                if (text.toLowerCase() == "sb" || text == "傻逼" || text == "煞笔") {
                    ev.reply({
                        type: "image",
                        file: readFileSync("./images/cat-cry.jpg")
                    });
                }
                if(text.toLowerCase().startsWith("获取mod信息") 
                || text.toLowerCase().startsWith("查询mod信息") 
                || text.toLowerCase().startsWith("mod信息")) {
                    const modName = text.substring(text.indexOf("信息") + "信息".length);
                    await printModInfo(ev.group, modName);
                }
                if(text.toLowerCase().startsWith("查询mod") 
                || text.toLowerCase().startsWith("mod查询")) {
                    const modName = text.substring("查询mod".length);
                    await printModInfo(ev.group, modName);
                }
                if(text.toLowerCase() == "所有mods" || text.toLowerCase().endsWith("所有mods")) {
                    await printAllMods(ev.group, ev.sender.user_id);
                }
                if(text.toLowerCase().startsWith("筛选mods:") || text.toLowerCase().startsWith("筛选mod:")) {
                    const filter = text.substring(text.indexOf(":") + 1);
                    client.logger.info("Filter: " + filter)
                    await printAllMods(ev.group, ev.sender.user_id, filter);
                }
            }
        }
    } catch (e: any) {
        ev.reply(await client.makeForwardMsg([{
            user_id: client.uin,
            nickname: "Exception",
            message: JSON.stringify(e)
        }]));
    }
});

setInterval(() => {
    if (new Date().getUTCHours() == 0) signGroups.length = 0;
    for (const group of (config["signGroup"] as number[])) {
        if (signGroups.includes(group)) continue;
        if (client.isOnline()) {
            signGroups.push(group);
            setTimeout(() => {
                try {
                    client.sendGroupMsg(group, "冒泡");
                } catch (e) {
                    const id = signGroups.indexOf(group);
                    if (id != -1) signGroups.splice(id);
                }
            }, Math.random() * 1000);
        }
    }
}, 2000);

process.on("unhandledRejection", (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});
