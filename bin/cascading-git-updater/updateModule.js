"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var moduleAndUrl_1 = require("../domain/moduleAndUrl");
var BehaviorSubject_1 = require("rxjs/BehaviorSubject");
var Observable_1 = require("rxjs/Observable");
var print_1 = require("../utils/print");
var runCommand_1 = require("../utils/runCommand");
var gitOperations_1 = require("../utils/gitOperations");
var fs = require("fs");
var semver = require("semver");
var loge = print_1.Print.loge;
var logw = print_1.Print.logw;
var logv = print_1.Print.logv;
var logi = print_1.Print.logi;
var printDependencyMap = print_1.Print.printDependencyMap;
var modulesMapToList = moduleAndUrl_1.ModuleAndUrl.modulesMapToList;
var allInspected = moduleAndUrl_1.ModuleAndUrl.allInspected;
var runCommand = runCommand_1.RunCommand.runCommand;
var getModuleLatestVersion = gitOperations_1.Git.getModuleLatestVersion;
var isGitDirectoryDirtyOrPackageChanged = gitOperations_1.Git.isGitDirectoryDirtyOrPackageChanged;
var isGitMasterAheadOfTag = gitOperations_1.Git.isGitMasterAheadOfTag;
var depLists = moduleAndUrl_1.ModuleAndUrl.depLists;
var UpdateVersionAndPushModule = /** @class */ (function () {
    function UpdateVersionAndPushModule(dependencies, playground) {
        var updateModuleAndVersionItActor = new BehaviorSubject_1.BehaviorSubject(null);
        this.updateModuleAndVersionItActor = updateModuleAndVersionItActor;
        updateModuleAndVersionItActor.subscribe(function (mod) {
            if (mod) {
                printDependencyMap(dependencies, true, "NPM install, versionit and push any package.json updated modules");
                var hasAsDependency_1 = modulesMapToList(dependencies).filter(function (m) { return m.dependencies.hasOwnProperty(mod.module); });
                if (!mod.fetchedRepo && !mod.fetchingRepo) {
                    mod.fetchingRepo = true;
                    printDependencyMap(dependencies, true, "NPM install, versionit and push any package.json updated modules");
                    logi("Processing", mod.module);
                    getModuleLatestVersion(mod)
                        .map(function (m) { return isGitMasterAheadOfTag(m.latestVersion, m.repoDir, playground, m); }).switch()
                        .mergeMap(function (isAhead) {
                        if (isAhead) {
                            loge(mod.module, " : Master ahead of latest tag. Not processing it");
                            mod.hadError = true;
                            return Observable_1.Observable.of(false);
                        }
                        else {
                            return isGitDirectoryDirtyOrPackageChanged(mod);
                        }
                    })
                        .mergeMap(function (isDirty) {
                        if (isDirty) {
                            mod.fetchingRepo = false;
                            logw(mod.module, " : Dirty. npm install, versionit and git push");
                            return UpdateVersionAndPushModule.npmInstallGitCommitAndVersionitModule(mod, dependencies).catch(function (e) { return Observable_1.Observable.from([""]); });
                        }
                        else {
                            return Observable_1.Observable.of(mod.latestVersion);
                        }
                    })
                        .map(function (a) { return Observable_1.Observable.forkJoin(hasAsDependency_1.map(function (m) { return UpdateVersionAndPushModule.updatePackageInModule(mod, m); })); }).switch()
                        .subscribe(function (vals) {
                        logv(mod.module, "Done");
                        mod.fetchedRepo = true;
                    }, function (error) {
                        loge("Error", error);
                        mod.hadError = true;
                        mod.stopProcessing = true;
                        updateModuleAndVersionItActor.next(mod);
                        loge(error);
                    }, function () {
                        mod.stopProcessing = true;
                        updateModuleAndVersionItActor.next(mod);
                    });
                }
                if (mod.stopProcessing) {
                    hasAsDependency_1.forEach(function (m) {
                        try {
                            delete m.dependencies[mod.module];
                            if (Object.keys(m.dependencies).length == 0) {
                                updateModuleAndVersionItActor.next(m);
                            }
                        }
                        catch (err) {
                            loge("Error in update module and versioning it", err);
                        }
                    });
                }
                if (allInspected(dependencies)) {
                    updateModuleAndVersionItActor.complete();
                }
            }
        }, function (error) {
            loge("Error", error);
        }, function () {
            logi("We're done here.");
        });
    }
    UpdateVersionAndPushModule.prototype.next = function (mod) {
        this.updateModuleAndVersionItActor.next(mod);
    };
    UpdateVersionAndPushModule.npmInstallGitCommitAndVersionitModule = function (mod, dependencies) {
        if (mod.packageJsonChanged) {
            logw("Updating package.json for", mod.module);
            fs.writeFileSync(mod.repoDir + '/package.json', JSON.stringify(mod.packageJson, null, 4));
        }
        var runAndUpdate = function (cmd) {
            mod.currentCommand = cmd;
            printDependencyMap(dependencies, true, "NPM install, versionit and push any package.json updated modules");
            return runCommand(cmd, mod.repoDir, mod);
        };
        console.log("PFB:", mod.prepForBuild, "\nBuild:", mod.build, "\nVAP:", mod.versionAndPush);
        console.log(">>", mod.prepForBuild.concat(mod.build).concat(mod.versionAndPush));
        console.log(">>>", mod.prepForBuild.concat(mod.build).concat(mod.versionAndPush).map(function (v) {
            return v.condition ? "if " + v.condition + "; then " + v.cmd + "; fi"
                : v.cmd;
        }));
        // Concatenate the prep build, build and version push
        return (mod.prepForBuild.concat(mod.build).concat(mod.versionAndPush))
            // Change the command if there is a conditional
            .map(function (v) {
            return v.condition ? "bash -c 'if " + v.condition + "; then " + v.cmd + "; fi'"
                : v.cmd;
        })
            // Chain all the observables together using a mergeMap
            .reduce(function (previousValue, currentValue, currentIndex) { return previousValue.mergeMap(function (ss) { return runAndUpdate(currentValue); }); }, Observable_1.Observable.of(""))
            // .reduceRight<Observable<string>(((previousValue, currentValue, i, arr) => previousValue.mergeMap(ss => runAndUpdate(currentValue))), Observable.of(""))
            // After all is done, fetch the latest version for the module
            .mergeMap(function (s) { return getModuleLatestVersion(mod); })
            // Return the latest version
            .map(function (a) { return a.latestVersion; });
    };
    ;
    UpdateVersionAndPushModule.updatePackageInModule = function (dep, mod) {
        if (semver.lt(mod.dependencies[dep.module].version, dep.latestVersion)) {
            return Observable_1.Observable.create(function (observer) {
                logw("Updating ", dep.module, "in", mod.module, "=>", dep.latestVersion, "[" + mod.dependencies[dep.module].version + "]");
                mod.packageJsonChanged = true;
                if (!mod.packageJson) {
                    mod.packageJson = JSON.parse(fs.readFileSync(mod.repoDir + '/package.json'));
                }
                var pj = mod.packageJson;
                var version = (dep.url.startsWith("http") ? dep.module + "-" : "") + dep.latestVersion;
                var url = (dep.url.startsWith("http") ? "" : "ssh://") + dep.url;
                depLists.forEach(function (l) {
                    if (pj[l] && pj[l][dep.module]) {
                        pj[l][dep.module] = "git+" + url + "#" + version;
                    }
                });
                observer.next(dep.module);
                observer.complete();
            });
        }
        else {
            return Observable_1.Observable.from([]);
        }
    };
    ;
    return UpdateVersionAndPushModule;
}());
exports.UpdateVersionAndPushModule = UpdateVersionAndPushModule;
//# sourceMappingURL=updateModule.js.map