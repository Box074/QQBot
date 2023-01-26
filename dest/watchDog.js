import * as cp from "child_process";
function StartRobot() {
    var proc = cp.fork("./dest/main.js");
    proc.on("exit", (code, signal) => {
        if (code && code > 50) {
            process.exit();
        }
        StartRobot();
    });
}
StartRobot();
//# sourceMappingURL=watchDog.js.map