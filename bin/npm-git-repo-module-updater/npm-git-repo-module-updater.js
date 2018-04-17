#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Rx_1 = require("rxjs/Rx");
var fs = require("fs");
var semver = require("semver");
var inquirer = require("inquirer");
var commander = require("commander");
var semverDiff = require("semver-diff");
var print_1 = require("../utils/print");
var moduleAndUrl_1 = require("../domain/moduleAndUrl");
var runCommand_1 = require("../utils/runCommand");
var logi = print_1.Print.logi;
var loge = print_1.Print.loge;
var logw = print_1.Print.logw;
var logv = print_1.Print.logv;
var padRight = print_1.Print.padRight;
commander
    .version('0.1.8')
    .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-d --dev', 'Update dev dependencies also')
    .parse(process.argv);
if (commander.all) {
    logv("Automatically updating all git modules");
}
var depLists = ['dependencies', 'devDependencies', 'peerDependencies'];
if (commander.dev) {
    depLists.push('devDependencies');
}
var flatMap = function (f, xs) {
    return xs.reduce(function (acc, x) {
        return acc.concat(f(x));
    }, []);
};
runCommand_1.RunCommand.startListeningToCommands(5);
//Map that has the module name with its description
var dependencies = new Map(flatMap(function (depList) {
    var dependenciesObj = JSON.parse(fs.readFileSync("package.json"))[depList];
    var list = [];
    for (var dep in dependenciesObj) {
        if (dependenciesObj.hasOwnProperty(dep)) {
            var ver = dependenciesObj[dep];
            if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                var m = new moduleAndUrl_1.ModuleAndUrl();
                m.module = dep;
                m.url = ver.substring("git+ssh://".length, ver.indexOf("#"));
                m.version = ver.substring(ver.indexOf("#") + 1);
                m.depList = depList;
                list.push([dep, m]);
            }
        }
    }
    return list;
}, depLists));
//Get all the values of the map
var values = Array.from(dependencies.values());
var maxLength = values && values.length > 0 ? values.sort(function (a, b) { return a.module.length > b.module.length ? -1 : 1; })[0].module.length : 0;
Rx_1.Observable.forkJoin(values.map(function (a) {
    return runCommand_1.RunCommand.runCommand('git ls-remote -t ' + a.url, './')
        .map(function (output) {
        return output
            .split('\n')
            .filter(function (l) { return l; }) //Get rid of empty lines
            .map(function (l) { return l.split("\t")[1].substr("refs/tags/".length); })
            .filter(function (l) { return semver.valid(l); })
            .sort(function (a, b) { return semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0; });
    })
        .map(function (l) { return l.length > 0 ? l[0] : '0.0.0'; })
        .onErrorResumeNext(function (e) { return '0.0.0'; })
        .filter(function (l) { return l && l != ''; })
        .do(function (v) { return a.latestVersion = v; })
        .map(function (v) { return a; })
        .do(function (m) {
        if (m.latestVersion != m.version) {
            logw(padRight(m.module, maxLength) + " :R ", m.latestVersion, "L:", m.version);
        }
        else {
            logv(padRight(m.module, maxLength) + " :R ", m.latestVersion, "L:", m.version);
        }
    });
}))
    .subscribe(function (a) {
    var auto = a.filter(function (aa) {
        if (semver.valid(aa.latestVersion)
            && semver.valid(aa.version)) {
            if (semver.gt(aa.latestVersion, aa.version)
                && (commander.all || ["patch", "null"].some(function (v) { return v == semverDiff(aa.latestVersion, aa.version); }))) {
                logw("Automatically updating " + aa.module + " to " + aa.latestVersion);
                return true;
            }
        }
        else {
            loge("Could not parse version ", aa.version, " or ", aa.latestVersion);
        }
        return false;
    });
    var nonAutoChoices = a
        .filter(function (aa) { return !auto.find(function (bb) { return bb.module == aa.module; }); }) //Invert auto list
        .filter(function (aa) { return semver.valid(aa.latestVersion)
        && semver.valid(aa.version)
        && semver.gt(aa.latestVersion, aa.version); }) //Only add those whose values are gt
        .map(function (aa) {
        return {
            type: 'confirm',
            name: aa.module,
            message: 'Update ' + aa.module + ' : ' + aa.version + " -> " + aa.latestVersion
        };
    });
    inquirer.prompt(nonAutoChoices).then(function (answers) {
        var pj = JSON.parse(fs.readFileSync("package.json"));
        var updatePackageJson = function (module) {
            logi("package.json: Updating ", module.module);
            var version = (module.url.startsWith("http") ? module.module + "-" : "") + module.latestVersion;
            var url = (module.url.startsWith("http") ? "" : "ssh://") + module.url;
            depLists.forEach(function (l) {
                if (pj[l] && pj[l][module.module]) {
                    pj[l][module.module] = "git+" + url + "#" + version;
                }
            });
        };
        //The prompt return is { "key" : true/false, ... }
        Object.keys(answers).filter(function (a) { return answers[a]; }).forEach(function (a) {
            updatePackageJson(dependencies[a]);
        });
        auto.forEach(function (a) {
            updatePackageJson(a);
        });
        fs.writeFileSync("package.json", JSON.stringify(pj, null, 4)); //Write the file
    });
});
//# sourceMappingURL=npm-git-repo-module-updater.js.map