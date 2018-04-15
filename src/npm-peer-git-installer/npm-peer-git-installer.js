#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Rx_1 = require("rxjs/Rx");
var exec = require('child_process');
var fs = require("fs");
var semver = require("semver");
var commander = require("commander");
var colors = require("colors");
var clear = require('clear');
var npm = require('enpeem');
var runCommand_1 = require("../utils/runCommand");
var print_1 = require("../utils/print");
var logi = print_1.Print.logi;
var loge = print_1.Print.loge;
var logv = print_1.Print.logv;
var logw = print_1.Print.logw;
colors.setTheme({
    verbose: 'cyan',
    info: 'green',
    warn: 'yellow',
    error: 'red'
});
commander
    .version('0.1.8')
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-p --print', 'Print packages when state changes')
    .parse(process.argv);
var packages = [];
var padRight = function (val, theMaxLength) {
    var len = theMaxLength - val.length;
    var pad = '';
    while (len--) {
        pad += ' ';
    }
    return val + pad;
};
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
var getVersionFromGitString = function (ver) {
    return ver.substring(ver.indexOf("#") + 1);
};
var getGitRepoFromGitString = function (ver) {
    return ver.substring("git+ssh://".length, ver.indexOf("#"));
};
var installDependencies = function () {
    var dependencies = packages.map(function (a) { return a.name + '@' + (!!a.git ? a.git : a.version); });
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
var loadPackageJsonFromGit = function (repo, version) {
    runCommand_1.RunCommand.runCommand("git archive --remote=" + repo + " " + version + " package.json | tar xfO - ", "./")
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
    clear();
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
    installDependencies();
};
runCommand_1.RunCommand.startListeningToCommands(5);
runCommand_1.RunCommand.runCommand("cat package.json", "./").subscribe(function (a) { return parsePackageJson(a); });
//# sourceMappingURL=npm-peer-git-installer.js.map