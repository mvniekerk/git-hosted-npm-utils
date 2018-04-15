"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var moduleAndUrl_1 = require("../domain/moduleAndUrl");
var BehaviorSubject_1 = require("rxjs/BehaviorSubject");
var print_1 = require("../utils/print");
var runCommand_1 = require("../utils/runCommand");
var fs = require("fs");
var loge = print_1.Print.loge;
var logw = print_1.Print.logw;
var logv = print_1.Print.logv;
var logi = print_1.Print.logi;
var printDependencyMap = print_1.Print.printDependencyMap;
var modulesMapToList = moduleAndUrl_1.ModuleAndUrl.modulesMapToList;
var allInspected = moduleAndUrl_1.ModuleAndUrl.allInspected;
/**
 * Helper class that fetches a git based module and its git dependencies
 */
var AllDependenciesFetcher = /** @class */ (function () {
    function AllDependenciesFetcher(defaultCommands, dependencies, playground, updater) {
        var _this = this;
        this.dependencies = dependencies;
        this.playground = playground;
        this.updater = updater;
        console.log("Dependencies: ", dependencies);
        var cloneAndPullModuleAndDependenciesActor = new BehaviorSubject_1.BehaviorSubject(null);
        this.cloneAndPullModuleAndDependenciesActor = cloneAndPullModuleAndDependenciesActor;
        this.cloneAndPullModuleAndDependenciesActor.subscribe(function (mod) {
            if (mod) {
                printDependencyMap(dependencies, true, "Checkout dependency git repos");
                if (dependencies.hasOwnProperty(mod.module)) {
                    logv("Ignoring", mod.module);
                }
                else {
                    dependencies[mod.module] = mod;
                    logi("Processing", mod.module);
                    var expectedDir_1 = mod.url.substr(mod.url.lastIndexOf(":") + 1);
                    expectedDir_1 = expectedDir_1
                        .substring(expectedDir_1.lastIndexOf("/") + 1, expectedDir_1.length - 1 - (expectedDir_1.endsWith(".git") ? ".git".length - 1 : 0)) + "/";
                    mod.repoDir = expectedDir_1;
                    var doCheckout_1 = function () {
                        runCommand_1.RunCommand.runCommand('git pull --all', expectedDir_1, mod).subscribe(function (a) {
                            mod.fetchedRepo = true;
                            printDependencyMap(dependencies, true);
                            try {
                                moduleAndUrl_1.ModuleAndUrl.checkForGitDependencies(defaultCommands, mod.dependencies, playground, expectedDir_1);
                                if (mod.dependencies) {
                                    Object.keys(mod.dependencies).forEach(function (key) { return cloneAndPullModuleAndDependenciesActor.next(mod.dependencies[key]); });
                                }
                            }
                            catch (err) {
                                loge(mod.module, ": Could not process git dependencies");
                                loge(mod.module, err);
                                mod.hadError = true;
                            }
                            mod.stopProcessing = true;
                            cloneAndPullModuleAndDependenciesActor.next(mod);
                        });
                    };
                    try {
                        fs.statSync(expectedDir_1);
                        doCheckout_1();
                    }
                    catch (error) {
                        logw("Module directory for " + mod.module + "doesn't exist yet, cloning");
                        runCommand_1.RunCommand.runCommand('git clone ' + mod.url, null, mod).subscribe(function (a) {
                            doCheckout_1();
                        });
                    }
                }
                if (mod.stopProcessing) {
                    mod.processed = true;
                }
                if (allInspected(_this.dependencies)) {
                    console.log("We're done getting the list of dependencies");
                    cloneAndPullModuleAndDependenciesActor.complete();
                }
            }
        }, function (error) {
            loge("We have and error", error);
        }, function () { return _this.doneWithGitCloneAndDependencyInspection(dependencies); });
    }
    AllDependenciesFetcher.prototype.doneWithGitCloneAndDependencyInspection = function (dependencies) {
        var _this = this;
        var allModules = modulesMapToList(dependencies);
        var errorModules = modulesMapToList(dependencies).filter(function (m) { return m.hadError; });
        if (errorModules) {
            logw("Modules with errors:", errorModules.map(function (m) { return m.module; }));
            errorModules.forEach(function (m) {
                delete dependencies[m.module];
                allModules.forEach(function (mm) {
                    delete mm.dependencies[m.module];
                });
            });
        }
        allModules = modulesMapToList(dependencies);
        allModules.forEach(function (m) {
            m.fetchedRepo = false;
            m.fetchingRepo = false;
            m.stopProcessing = false;
            m.processed = false;
        });
        allModules.filter(function (m) { return Object.keys(m.dependencies).length == 0; }).forEach(function (m) { return _this.updater.next(m); });
    };
    ;
    AllDependenciesFetcher.prototype.next = function (m) {
        this.cloneAndPullModuleAndDependenciesActor.next(m);
    };
    AllDependenciesFetcher.prototype.start = function (mm) {
        var _this = this;
        mm.forEach(function (m) { return _this.next(m); });
    };
    return AllDependenciesFetcher;
}());
exports.AllDependenciesFetcher = AllDependenciesFetcher;
//# sourceMappingURL=allDependenciesFetcher.js.map