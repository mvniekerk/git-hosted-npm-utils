import {ExecOptions} from "child_process";
import {Subject, Observer, Observable, BehaviorSubject} from 'rxjs/Rx';
import {ModuleAndUrl} from '../domain/moduleAndUrl';
const fs = require("fs");
const exec = require('child_process');
import {Print} from './print';
const loge = Print.loge;
const logi = Print.logi;

/**
 * A helper class that runs commands. A configurable max threads that defaults to 5 (set to 0 for no limit)
 */
export class RunCommand {

    private static currentCommands = new BehaviorSubject<{cmd: string, dir: string, observer: Observer<string>, mod?: ModuleAndUrl}>(null);

    /**
     * Start listening to commands.
     * @param {number} amountAtATime    Max amount of commands to run at a time. Set to 0 for no limit.
     */
    public static startListeningToCommands(amountAtATime = 5) {
        logi("Starting to listen to commands " + amountAtATime);
        const totalRunning = new BehaviorSubject(0);
        const pausableBufferedObservable: Observable<{cmd: string, dir: string, observer: Observer<string>, mod?: ModuleAndUrl}> = Observable.create(sub => {
            let source = RunCommand.currentCommands.asObservable();

            let isEnabled = false;
            const closeBuffer = new Subject();
            const bufferIn = new Subject();

            const buffer = bufferIn.buffer(closeBuffer);
            buffer.subscribe((bufferedValues: {cmd: string, dir: string, observer: Observer<string>, mod?: ModuleAndUrl}[]) => {
                let toBeSent = amountAtATime - totalRunning.value;
                toBeSent = bufferedValues.length > toBeSent ? toBeSent : bufferedValues.length;
                if (toBeSent > 0) {
                    bufferedValues.slice(0, toBeSent).forEach(v => sub.next(v));
                    bufferedValues.slice(toBeSent).forEach(v => RunCommand.currentCommands.next(v));
                } else {
                    bufferedValues.forEach(val => RunCommand.currentCommands.next(val));
                }
            });

            totalRunning.subscribe(a => {
                // Print.currentTotalRunning = a;
                isEnabled = amountAtATime == 0 || a < amountAtATime;
                if (isEnabled) {
                    closeBuffer.next(0);
                }
            });

            return source.subscribe(value => {
                    try {
                        if (isEnabled) {
                            sub.next(value);
                        } else {
                            bufferIn.next(value);
                        }
                    } catch (err) {
                        sub.error(err);
                    }
                },
                err => sub.error(err),
                () => sub.complete());
        });
        pausableBufferedObservable.subscribe(a => {
            if (!a) {
                return;
            }
            Print.currentTotalRunning = Print.currentTotalRunning + 1;
            totalRunning.next(Print.currentTotalRunning);
            const dir = a.dir;
            const cmd = a.cmd;
            const mod = a.mod;
            const observer = a.observer;
            if (mod) {
                mod.currentCommand = cmd;
            }
            fs.appendFileSync("output.txt", "\n>" + dir + " [" + cmd + "]");
            const options:ExecOptions = {};
            options.cwd = dir;
            exec.exec(cmd, options, (error:Error, stdout:string, stderr:string) => {
                Print.currentTotalRunning = Print.currentTotalRunning - 1;
                totalRunning.next(Print.currentTotalRunning);
                fs.appendFileSync("output.txt", "\n<" + dir + " O[" + stdout + "] E[" + stderr + "]");
                if (mod) {
                    mod.currentCommand = "";
                }
                if (error && error.message) {
                    if (mod) {
                        loge(mod.module, cmd, error.message);
                    } else {
                        loge(cmd, error.message);
                    }
                    mod.errors = (mod.errors ? mod.errors + "\n" : "") + error;
                    Observable.throw(error);
                } else {
                    observer.next(stdout.toString().trim());
                    observer.complete();
                }
            });
        });
    }

    public static runCommand(cmd: string, dir: string, mod?:ModuleAndUrl): Observable<string> {
        if (!cmd || !cmd.trim()) {
            return Observable.of("");
        }

        return Observable.create((observer: Observer<string>) => {
            RunCommand.currentCommands.next({cmd: cmd, dir: dir, observer: observer, mod: mod});
        });
    };
}