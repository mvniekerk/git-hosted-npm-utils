#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Rx_1 = require("rxjs/Rx");
var fs = require("fs");
var semver = require("semver");
var commander = require("commander");
var clear = require('clear');
var print_1 = require("../utils/print");
var runCommand_1 = require("../utils/runCommand");
var gitOperations_1 = require("../utils/gitOperations");
var logi = print_1.Print.logi;
var loge = print_1.Print.loge;
var logv = print_1.Print.logv;
var logw = print_1.Print.logw;
var getVersionFromGitString = gitOperations_1.Git.getVersionFromGitString;
var getGitRepoFromGitString = gitOperations_1.Git.getGitRepoFromGitString;
var padRight = print_1.Print.padRight;
var runCommand = runCommand_1.RunCommand.runCommand;
commander
    .version('0.1.8')
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-p --print', 'Print packages when state changes')
    .parse(process.argv);
var packages = [];
runCommand_1.RunCommand.startListeningToCommands(5);
var printPackages = function () {
    if (!commander.print) {
        return;
    }
    var longestName = packages.reduce(function (a, b, i) { return b.name.length > a ? b.name.length : a; }, "Package".length) + 1;
    var longestVersion = packages.reduce(function (a, b, i) { return b.version.length > a ? b.version.length : a; }, "Version".length) + 1;
    var longestGit = packages.reduce(function (a, b, i) { return b.git.length > a ? b.git.length : a; }, "Git".length) + 1;
    var padFalse = "L".length + 1;
    logi(padRight("Package", longestName) + "| " + padRight("L", padFalse) + "| " + padRight("Version", longestVersion) + "| " + padRight("Git", longestGit));
    packages.sort(function (a, b) { return a.name > b.name ? 1 : -1; }).forEach(function (a) {
        logi(padRight(a.name, longestName) + "| " + padRight(a.loaded ? "Y" : a.handled ? "H" : " ", padFalse) + "| " + padRight(a.version, longestVersion) + "| " + padRight(a.git, longestGit));
    });
};
var installDependencies = function () {
    var dependencies = packages.map(function (a) { return a.name + '@' + (!!a.git ? a.git : a.version); });
    logv("Dependencies:\n\t" + dependencies.join("\n\t"));
    fs.exists("ng-package.json", function (exists) {
        (!exists
            ?
                Rx_1.Observable.merge(Rx_1.Observable.of("ng-package.json")
                    .map(function (fn) {
                    var template = '{\n' +
                        '    "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",\n' +
                        '    "lib": {\n' +
                        '        "entryFile": "public_api.ts",\n' +
                        '        "externals": {\n' +
                        '        }\n' +
                        '    }\n' +
                        '}';
                    fs.writeFileSync(fn, template);
                    return "";
                }), Rx_1.Observable.of("public_api.ts")
                    .map(function (fn) {
                    fs.writeFileSync(fn, "export * from './src/app/app.module';\n");
                    return "";
                })).last()
            : Rx_1.Observable.of(""))
            .mergeMap(function (a) { return runCommand("cat ng-package.json", "./"); })
            .map(function (a) { return JSON.parse(a); })
            .map(function (a) {
            var lib = a['lib'];
            if (!lib['externals']) {
                lib['externals'] = {};
            }
            var externals = lib['externals'];
            packages.forEach(function (p) {
                if (!externals[p.name]) {
                    externals[p.name] = p.name;
                }
                if (p.git && !externals[p.name + '/dist/' + p.name]) {
                    externals[p.name + '/dist/' + p.name] = p.name + '/dist/' + p.name;
                }
                if (p.git && !externals[p.name + '/public_api']) {
                    externals[p.name + '/public_api'] = p.name + '/dist/' + p.name;
                }
            });
            return a;
        })
            .subscribe(function (a) { return fs.writeFileSync('ng-package.json', JSON.stringify(a, null, 4)); });
    });
};
var loadPackageJsonFromGit = function (repo, version) {
    runCommand("git archive --remote=" + repo + " " + version + " package.json | tar xfO - ", "./")
        .subscribe(function (a) { return parsePackageJson(a); });
};
var loadPackageActor = new Rx_1.BehaviorSubject("");
loadPackageActor.subscribe(function (a) {
    if (!a) {
        return;
    }
    var p = packages.find(function (aa) { return aa.name == a; });
    if (!p) {
        loge("Could not find " + a);
        return;
    }
    var repo = getGitRepoFromGitString(p.git);
    var version = getVersionFromGitString(p.git);
    loadPackageJsonFromGit(repo, version);
});
var parsePackageJson = function (json) {
    if (commander.print) {
        clear();
    }
    printPackages();
    var val = JSON.parse(json);
    var me = packages.find(function (a) { return a.name == val["name"]; });
    if (me && me.handled) {
        logi(val["name"] + " : Skipping");
        return;
    }
    if (me) {
        me.handled = true;
    }
    logw("Loading: ", val["name"]);
    var peerDeps = val["peerDependencies"];
    var _loop_1 = function (key) {
        if (peerDeps.hasOwnProperty(key)) {
            var ver = peerDeps[key];
            if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                logv(key + " : Checking");
                var h = packages.find(function (a) { return a.name == key; });
                var version = getVersionFromGitString(ver);
                if (!h) {
                    packages.push({ loaded: false, handled: false, name: key, git: ver, version: version });
                    loadPackageActor.next(key);
                }
                else {
                    if (semver.lt(h.version, version)) {
                        h.version = version;
                    }
                }
            }
            else {
                var h = packages.find(function (a) { return a.name == key; });
                if (!h) {
                    packages.push({ loaded: true, handled: true, name: key, git: "", version: ver });
                }
                else {
                    var inList = h.version.startsWith("^") ? h.version.substr(1) : h.version;
                    var current = ver.startsWith("^") ? ver.substr(1) : ver;
                    if (semver.lt(inList, current)) {
                        h.version = ver;
                    }
                }
            }
        }
    };
    for (var key in peerDeps) {
        _loop_1(key);
    }
    if (me) {
        me.loaded = true;
    }
    var count = packages.filter(function (a) { return !a.loaded || !a.handled; }).length;
    if (count == 0) {
        installDependencies();
    }
};
runCommand("cat package.json", "./").subscribe(function (a) { return parsePackageJson(a); });
//# sourceMappingURL=npm-peers-as-ng-externals.js.map