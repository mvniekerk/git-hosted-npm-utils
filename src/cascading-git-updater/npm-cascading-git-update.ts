#!/usr/bin/env node
import {Print} from "../utils/print";

const fs = require("fs");
const commander = require("commander");
const colors = require("colors");
import {CommandAndCondition, ModuleAndUrl} from '../domain/moduleAndUrl';
import {RunCommand} from '../utils/runCommand';
import {AllDependenciesFetcher} from "./allDependenciesFetcher";
import {UpdateVersionAndPushModule} from "./updateModule";

const modulesMapToList = ModuleAndUrl.modulesMapToList;
const exitHook = require('exit-hook');

colors.setTheme({
    verbose: 'cyan',
    info: 'green',
    warn: 'yellow',
    error: 'red'
});

const logv = Print.logv;
const loge = Print.loge;

const version = JSON.parse(fs.readFileSync(__dirname + "/package.json"));

commander
    .version(version.version)
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .parse(process.argv);

const playground: Map<string, ModuleAndUrl> = new Map<string, ModuleAndUrl>();
const defaultCommands: {prepForBuild: CommandAndCondition[], build: CommandAndCondition[], versionAndPush: CommandAndCondition[]} = {prepForBuild: [], build: [], versionAndPush: []};
try {
    const p = JSON.parse(fs.readFileSync("cascading-updater.json"));
    const maxCommands = p['maxCommands'] != null ? p['maxCommands'] : 5;
    RunCommand.startListeningToCommands(maxCommands);

    const cmdMapper = (a: any) => {
        const ret = new CommandAndCondition();
        ret.cmd = a.cmd;
        ret.condition = a.condition;
        return ret;
    };

    defaultCommands.prepForBuild = (
        p['commands'] && p['commands']['prepForBuild']
            ? p['commands']['prepForBuild']
            : [
                {"cmd": "rm package-lock.json", "condition": "[ -f package-lock.json ]"},
                {"cmd": "npm install"},
                {"cmd": "npm run prep-peers", "condition": "[[ ! -z `cat package.json | grep prep-peers` ]]"}
            ]
        ).map(cmdMapper);
    defaultCommands.build = (
        p['commands'] && p['commands']['build']
        ? p['commands']['build']
        : [
            {"cmd": "npm run build"},
            {"cmd": "npm run bundles"}
        ])
        .map(cmdMapper);
    defaultCommands.versionAndPush = (
        p['commands'] && p['commands']['versionAndPush']
        ? p['commands']['versionAndPush']
        : [
                {"cmd": "git add ."},
                {"cmd": "git commit -m \"Auto package.json updates\"", "condition": "[[ ! -z `git status --porcelain`]]"},
                {"cmd": "versionit bump"},
                {"cmd": "git push --follow-tags"}
            ]
    ).map(cmdMapper);
    for (let m in p["modules"]) {
        if (p["modules"].hasOwnProperty(m)) {
            playground[m] = <ModuleAndUrl>p["modules"][m];
            playground[m].module = m;
            playground[m].dependencies = new Map<string, ModuleAndUrl>();
            playground[m].currentCommand = '';
            playground[m].packageJsonChanged = false;
            if (p["modules"][m]["commands"]) {
                const commands = p["modules"][m]["commands"];
                if (commands["prepForBuild"]) {
                    playground[m].prepForBuild = commands["prepForBuild"].map(cmdMapper);
                }
                if (commands["build"]) {
                    playground[m].prepForBuild = commands["build"].map(cmdMapper);
                }
                if (commands["versionAndPush"]) {
                    playground[m].versionAndPush = commands["versionAndPush"].map(cmdMapper);
                }
            }
        }
    }
    logv("Read cascading-updater.json");
} catch (err) {
    console.log("Could not open cascading-updater.json");
    console.log(err);
}

if (!playground) {
    commander.help();
}

//Map that has the module name with its description
const dependencies = new Map<string, ModuleAndUrl>();
const mainModules: ModuleAndUrl[] = modulesMapToList(playground);

exitHook(() => {
    Object.keys(dependencies).forEach(key => {
        if (dependencies[key]) {
            const mod = dependencies[key];
            if (mod.errors) {
                logv(mod.module + "\n====================");
                loge("\t" + mod.errors);
            }
        }
    });
});

const updater = new UpdateVersionAndPushModule(dependencies, playground);
new AllDependenciesFetcher(defaultCommands, dependencies, playground, updater).start(mainModules);
