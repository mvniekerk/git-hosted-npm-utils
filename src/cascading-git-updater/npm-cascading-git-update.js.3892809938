#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var print_1 = require("../utils/print");
var fs = require("fs");
var commander = require("commander");
var colors = require("colors");
var moduleAndUrl_1 = require("../domain/moduleAndUrl");
var runCommand_1 = require("../utils/runCommand");
var allDependenciesFetcher_1 = require("./allDependenciesFetcher");
var updateModule_1 = require("./updateModule");
var modulesMapToList = moduleAndUrl_1.ModuleAndUrl.modulesMapToList;
var exitHook = require('exit-hook');
colors.setTheme({
    verbose: 'cyan',
    info: 'green',
    warn: 'yellow',
    error: 'red'
});
var logv = print_1.Print.logv;
var loge = print_1.Print.loge;
var version = JSON.parse(fs.readFileSync(__dirname + "/package.json"));
commander
    .version(version.version)
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .parse(process.argv);
var playground = new Map();
var defaultCommands = { prepForBuild: [], build: [], versionAndPush: [] };
try {
    var p = JSON.parse(fs.readFileSync("cascading-updater.json"));
    var maxCommands = p['maxCommands'] != null ? p['maxCommands'] : 5;
    runCommand_1.RunCommand.startListeningToCommands(maxCommands);
    var cmdMapper = function (a) {
        var ret = new moduleAndUrl_1.CommandAndCondition();
        ret.cmd = a.cmd;
        ret.condition = a.condition;
        return ret;
    };
    defaultCommands.prepForBuild = (p['commands'] && p['commands']['prepForBuild']
        ? p['commands']['prepForBuild']
        : [
            { "cmd": "rm package-lock.json", "condition": "[ -f package-lock.json ]" },
            { "cmd": "npm install" },
            { "cmd": "npm run prep-peers", "condition": "[[ ! -z `cat package.json | grep prep-peers` ]]" }
        ]).map(cmdMapper);
    defaultCommands.build = (p['commands'] && p['commands']['build']
        ? p['commands']['build']
        : [
            { "cmd": "npm run build" },
            { "cmd": "npm run bundles" }
        ])
        .map(cmdMapper);
    defaultCommands.versionAndPush = (p['commands'] && p['commands']['versionAndPush']
        ? p['commands']['versionAndPush']
        : [
            { "cmd": "git add ." },
            { "cmd": "git commit -m \"Auto package.json updates\"", "condition": "[[ ! -z `git status --porcelain`]]" },
            { "cmd": "versionit bump" },
            { "cmd": "git push --follow-tags" }
        ]).map(cmdMapper);
    for (var m in p["modules"]) {
        if (p["modules"].hasOwnProperty(m)) {
            playground[m] = p["modules"][m];
            playground[m].module = m;
            playground[m].dependencies = new Map();
            playground[m].currentCommand = '';
            playground[m].packageJsonChanged = false;
            if (p["modules"][m]["commands"]) {
                var commands = p["modules"][m]["commands"];
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
}
catch (err) {
    console.log("Could not open cascading-updater.json");
    console.log(err);
}
if (!playground) {
    commander.help();
}
//Map that has the module name with its description
var dependencies = new Map();
var mainModules = modulesMapToList(playground);
exitHook(function () {
    Object.keys(dependencies).forEach(function (key) {
        if (dependencies[key]) {
            var mod = dependencies[key];
            if (mod.errors) {
                logv(mod.module + "\n====================");
                loge("\t" + mod.errors);
            }
        }
    });
});
var updater = new updateModule_1.UpdateVersionAndPushModule(dependencies, playground);
new allDependenciesFetcher_1.AllDependenciesFetcher(defaultCommands, dependencies, playground, updater).start(mainModules);
//# sourceMappingURL=npm-cascading-git-update.js.map