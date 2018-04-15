import {CommandAndCondition, ModuleAndUrl} from "../domain/moduleAndUrl";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Print} from '../utils/print';
import {RunCommand} from "../utils/runCommand";
import {UpdateVersionAndPushModule} from "./updateModule";
const fs = require("fs");
const loge = Print.loge;
const logw = Print.logw;
const logv = Print.logv;
const logi = Print.logi;
const printDependencyMap = Print.printDependencyMap;
const modulesMapToList = ModuleAndUrl.modulesMapToList;
const allInspected = ModuleAndUrl.allInspected;

/**
 * Helper class that fetches a git based module and its git dependencies
 */
export class AllDependenciesFetcher {
    public cloneAndPullModuleAndDependenciesActor: BehaviorSubject<ModuleAndUrl>;

    constructor(
        defaultCommands: {prepForBuild: CommandAndCondition[], build: CommandAndCondition[], versionAndPush: CommandAndCondition[]},
        private dependencies: Map<string, ModuleAndUrl>, private playground: Map<string, ModuleAndUrl>,
        private updater: UpdateVersionAndPushModule
    ) {
        console.log("Dependencies: ", dependencies);
        const cloneAndPullModuleAndDependenciesActor = new BehaviorSubject<ModuleAndUrl>(null);
        this.cloneAndPullModuleAndDependenciesActor = cloneAndPullModuleAndDependenciesActor;
        this.cloneAndPullModuleAndDependenciesActor.subscribe(
            (mod: ModuleAndUrl) => {
                if (mod) {
                    printDependencyMap(dependencies, true, "Checkout dependency git repos");
                    if (dependencies.hasOwnProperty(mod.module)) {
                        logv("Ignoring", mod.module);
                    } else {
                        dependencies[mod.module] = mod;
                        logi("Processing", mod.module);
                        let expectedDir = mod.url.substr(mod.url.lastIndexOf(":") + 1);
                        expectedDir = expectedDir
                            .substring(
                                expectedDir.lastIndexOf("/") + 1,
                                expectedDir.length - 1 - (expectedDir.endsWith(".git") ? ".git".length - 1 : 0)
                            ) + "/";
                        mod.repoDir = expectedDir;

                        const doCheckout = function () {
                            RunCommand.runCommand('git pull --all', expectedDir, mod).subscribe( a => {
                                mod.fetchedRepo = true;
                                printDependencyMap(dependencies, true);
                                try {
                                    ModuleAndUrl.checkForGitDependencies(defaultCommands, mod.dependencies, playground, expectedDir);
                                    if (mod.dependencies) {
                                        Object.keys(mod.dependencies).forEach((key: string) => cloneAndPullModuleAndDependenciesActor.next(mod.dependencies[key]));
                                    }
                                } catch (err) {
                                    loge(mod.module, ": Could not process git dependencies");
                                    loge(mod.module, err);
                                    mod.hadError = true;
                                }
                                mod.stopProcessing = true;
                                cloneAndPullModuleAndDependenciesActor.next(mod);
                            });
                        };

                        try {
                            fs.statSync(expectedDir);
                            doCheckout();
                        } catch (error) {
                            logw("Module directory for " + mod.module + "doesn't exist yet, cloning");
                            RunCommand.runCommand('git clone ' + mod.url, null, mod).subscribe(a => {
                                doCheckout();
                            });
                        }
                    }
                    if (mod.stopProcessing) {
                        mod.processed = true;
                    }
                    if (allInspected(this.dependencies)) {
                        console.log("We're done getting the list of dependencies");
                        cloneAndPullModuleAndDependenciesActor.complete();
                    }
                }
            },
            (error: any) => {
                loge("We have and error", error);
            },
            () => this.doneWithGitCloneAndDependencyInspection(dependencies)
        );
    }

    doneWithGitCloneAndDependencyInspection(dependencies: Map<string, ModuleAndUrl>) {
        let allModules = modulesMapToList(dependencies);
        const errorModules = modulesMapToList(dependencies).filter(m => m.hadError);
        if (errorModules) {
            logw("Modules with errors:", errorModules.map(m => m.module));
            errorModules.forEach(m => {
                delete dependencies[m.module];
                allModules.forEach(mm => {
                    delete mm.dependencies[m.module];
                });
            });
        }
        allModules = modulesMapToList(dependencies);
        allModules.forEach(m => {
            m.fetchedRepo = false;
            m.fetchingRepo = false;
            m.stopProcessing = false;
            m.processed = false;
        });
        allModules.filter(m => Object.keys(m.dependencies).length == 0).forEach(m => this.updater.next(m));
    };

    public next(m: ModuleAndUrl) {
        this.cloneAndPullModuleAndDependenciesActor.next(m);
    }

    public start(mm: ModuleAndUrl[]) {
        mm.forEach(m => this.next(m));
    }
}