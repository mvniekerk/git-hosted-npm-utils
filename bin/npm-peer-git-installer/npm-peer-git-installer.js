#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Rx_1 = require("rxjs/Rx");
var semver = require("semver");
var commander = require("commander");
var clear = require('clear');
var npm = require('enpeem');
var runCommand_1 = require("../utils/runCommand");
var print_1 = require("../utils/print");
var gitOperations_1 = require("../utils/gitOperations");
var logi = print_1.Print.logi;
var loge = print_1.Print.loge;
var logv = print_1.Print.logv;
var logw = print_1.Print.logw;
var padRight = print_1.Print.padRight;
var getVersionFromGitString = gitOperations_1.Git.getVersionFromGitString;
var getGitRepoFromGitString = gitOperations_1.Git.getGitRepoFromGitString;
var loadPackageJsonFromGit = gitOperations_1.Git.loadPackageJsonFromGit;
commander
    .version('0.1.8')
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-p --print', 'Print packages when state changes')
    .parse(process.argv);
var packages = [];
var printPackages = function () {
    if (!commander.print) {
        return;
    }
    var longestName = packages.reduce(function (a, b, i) { return b.module.length > a ? b.module.length : a; }, "Package".length) + 1;
    var longestVersion = packages.reduce(function (a, b, i) { return b.version.length > a ? b.version.length : a; }, "Version".length) + 1;
    var longestGit = packages.reduce(function (a, b, i) { return b.url.length > a ? b.url.length : a; }, "Git".length) + 1;
    var padFalse = "L".length + 1;
    logi(padRight("Package", longestName) + "| " + padRight("L", padFalse) + "| " + padRight("Version", longestVersion) + "| " + padRight("Git", longestGit));
    packages
        .sort(function (a, b) { return a.module > b.module ? 1 : -1; })
        .forEach(function (a) {
        logi(padRight(a.module, longestName) + "| " + padRight(a.loaded ? "Y" : a.handled ? "H" : " ", padFalse) + "| " + padRight(a.version, longestVersion) + "| " + padRight(a.url, longestGit));
    });
};
var installDependencies = function () {
    var dependencies = packages.map(function (a) { return a.module + '@' + (!!a.url ? a.url : a.version); });
    logv("Dependencies:\n\t" + dependencies.join("\n\t"));
    npm.install({
        dir: "./",
        dependencies: dependencies,
        'cache-min': 999999999
    }, function (e) {
        if (e) {
            loge("!!:", e);
        }
        else {
            logi("Done");
        }
    });
};
var loadPackageActor = new Rx_1.BehaviorSubject("");
loadPackageActor.filter(function (i) { return !!i; }).subscribe(function (a) {
    var p = packages.find(function (aa) { return aa.module == a; });
    if (!p) {
        loge("Could not find " + a);
        return;
    }
    var repo = getGitRepoFromGitString(p.url);
    var version = getVersionFromGitString(p.url);
    loadPackageJsonFromGit(repo, version).subscribe(function (a) { return parsePackageJson(a); });
});
var parsePackageJson = function (json) {
    clear();
    printPackages();
    var val = JSON.parse(json);
    var me = packages.find(function (a) { return a.module == val["name"]; });
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
                var h = packages.find(function (a) { return a.module == key; });
                var version = getVersionFromGitString(ver);
                if (!h) {
                    packages.push({ loaded: false, handled: false, module: key, url: ver, version: version });
                    loadPackageActor.next(key);
                }
                else {
                    if (semver.lt(h.version, version)) {
                        h.version = version;
                    }
                }
            }
            else {
                var h = packages.find(function (a) { return a.module == key; });
                if (!h) {
                    packages.push({ loaded: true, handled: true, module: key, url: "", version: ver });
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
    installDependencies();
};
runCommand_1.RunCommand.startListeningToCommands(5);
runCommand_1.RunCommand.runCommand("cat package.json", "./").subscribe(function (a) { return parsePackageJson(a); });
//# sourceMappingURL=npm-peer-git-installer.js.map