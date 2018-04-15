"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Rx_1 = require("rxjs/Rx");
var fs = require("fs");
var exec = require('child_process');
var print_1 = require("./print");
var loge = print_1.Print.loge;
var logi = print_1.Print.logi;
/**
 * A helper class that runs commands. A configurable max threads that defaults to 5 (set to 0 for no limit)
 */
var RunCommand = /** @class */ (function () {
    function RunCommand() {
    }
    /**
     * Start listening to commands.
     * @param {number} amountAtATime    Max amount of commands to run at a time. Set to 0 for no limit.
     */
    RunCommand.startListeningToCommands = function (amountAtATime) {
        if (amountAtATime === void 0) { amountAtATime = 5; }
        logi("Starting to listen to commands " + amountAtATime);
        var totalRunning = new Rx_1.BehaviorSubject(0);
        var pausableBufferedObservable = Rx_1.Observable.create(function (sub) {
            var source = RunCommand.currentCommands.asObservable();
            var isEnabled = false;
            var closeBuffer = new Rx_1.Subject();
            var bufferIn = new Rx_1.Subject();
            var buffer = bufferIn.buffer(closeBuffer);
            buffer.subscribe(function (bufferedValues) {
                var toBeSent = amountAtATime - totalRunning.value;
                toBeSent = bufferedValues.length > toBeSent ? toBeSent : bufferedValues.length;
                if (toBeSent > 0) {
                    bufferedValues.slice(0, toBeSent).forEach(function (v) { return sub.next(v); });
                    bufferedValues.slice(toBeSent).forEach(function (v) { return RunCommand.currentCommands.next(v); });
                }
                else {
                    bufferedValues.forEach(function (val) { return RunCommand.currentCommands.next(val); });
                }
            });
            totalRunning.subscribe(function (a) {
                // Print.currentTotalRunning = a;
                isEnabled = amountAtATime == 0 || a < amountAtATime;
                if (isEnabled) {
                    closeBuffer.next(0);
                }
            });
            return source.subscribe(function (value) {
                try {
                    if (isEnabled) {
                        sub.next(value);
                    }
                    else {
                        bufferIn.next(value);
                    }
                }
                catch (err) {
                    sub.error(err);
                }
            }, function (err) { return sub.error(err); }, function () { return sub.complete(); });
        });
        pausableBufferedObservable.subscribe(function (a) {
            if (!a) {
                return;
            }
            print_1.Print.currentTotalRunning = print_1.Print.currentTotalRunning + 1;
            totalRunning.next(print_1.Print.currentTotalRunning);
            var dir = a.dir;
            var cmd = a.cmd;
            var mod = a.mod;
            var observer = a.observer;
            if (mod) {
                mod.currentCommand = cmd;
            }
            fs.appendFileSync("output.txt", "\n>" + dir + " [" + cmd + "]");
            var options = {};
            options.cwd = dir;
            exec.exec(cmd, options, function (error, stdout, stderr) {
                print_1.Print.currentTotalRunning = print_1.Print.currentTotalRunning - 1;
                totalRunning.next(print_1.Print.currentTotalRunning);
                fs.appendFileSync("output.txt", "\n<" + dir + " O[" + stdout + "] E[" + stderr + "]");
                if (mod) {
                    mod.currentCommand = "";
                }
                if (error && error.message) {
                    if (mod) {
                        loge(mod.module, cmd, error.message);
                    }
                    else {
                        loge(cmd, error.message);
                    }
                    mod.errors = (mod.errors ? mod.errors + "\n" : "") + error;
                    Rx_1.Observable.throw(error);
                }
                else {
                    observer.next(stdout.toString().trim());
                    observer.complete();
                }
            });
        });
    };
    RunCommand.runCommand = function (cmd, dir, mod) {
        if (!cmd || !cmd.trim()) {
            return Rx_1.Observable.of("");
        }
        return Rx_1.Observable.create(function (observer) {
            RunCommand.currentCommands.next({ cmd: cmd, dir: dir, observer: observer, mod: mod });
        });
    };
    ;
    RunCommand.currentCommands = new Rx_1.BehaviorSubject(null);
    return RunCommand;
}());
exports.RunCommand = RunCommand;
//# sourceMappingURL=runCommand.js.map