import {ModuleAndUrl} from "../domain/moduleAndUrl";
import {BehaviorSubject} from "rxjs/BehaviorSubject";
import {Observable} from "rxjs/Observable";
import {Print} from '../utils/print';
import {RunCommand} from "../utils/runCommand";
import {Git} from '../utils/gitOperations';
import {Observer} from "rxjs/Rx";

const fs = require("fs");
const semver = require("semver");
const loge = Print.loge;
const logw = Print.logw;
const logv = Print.logv;
const logi = Print.logi;
const printDependencyMap = Print.printDependencyMap;
const modulesMapToList = ModuleAndUrl.modulesMapToList;
const allInspected = ModuleAndUrl.allInspected;
const runCommand = RunCommand.runCommand;
const getModuleLatestVersion = Git.getModuleLatestVersion;
const isGitDirectoryDirtyOrPackageChanged = Git.isGitDirectoryDirtyOrPackageChanged;
const isGitMasterAheadOfTag = Git.isGitMasterAheadOfTag;
const depLists = ModuleAndUrl.depLists;

export class UpdateVersionAndPushModule {
    private updateModuleAndVersionItActor: BehaviorSubject<ModuleAndUrl>;

    constructor(dependencies: Map<string, ModuleAndUrl>, playground: Map<string, ModuleAndUrl>) {
        const updateModuleAndVersionItActor = new BehaviorSubject<ModuleAndUrl>(null);
        this.updateModuleAndVersionItActor = updateModuleAndVersionItActor;
        updateModuleAndVersionItActor.subscribe(
            (mod: ModuleAndUrl) => {
                if (mod) {
                    printDependencyMap(dependencies, true, "NPM install, versionit and push any package.json updated modules");
                    const hasAsDependency = modulesMapToList(dependencies).filter(m => m.dependencies.hasOwnProperty(mod.module));
                    if (!mod.fetchedRepo && !mod.fetchingRepo) {
                        mod.fetchingRepo = true;
                        printDependencyMap(dependencies, true, "NPM install, versionit and push any package.json updated modules");
                        logi("Processing", mod.module);
                        getModuleLatestVersion(mod)
                            .map((m: ModuleAndUrl) => isGitMasterAheadOfTag(m.latestVersion, m.repoDir, playground, m)).switch()
                            .mergeMap((isAhead: boolean) => {
                                if (isAhead) {
                                    loge(mod.module, " : Master ahead of latest tag. Not processing it");
                                    mod.hadError = true;
                                    return Observable.of(false);
                                } else {
                                    return isGitDirectoryDirtyOrPackageChanged(mod);
                                }
                            })
                            .mergeMap((isDirty: boolean) => {
                                if (isDirty) {
                                    mod.fetchingRepo = false;
                                    logw(mod.module, " : Dirty. npm install, versionit and git push");
                                    return UpdateVersionAndPushModule.npmInstallGitCommitAndVersionitModule(mod, dependencies).catch(e => Observable.from([""]));
                                } else {
                                    return Observable.of(mod.latestVersion);
                                }
                            })
                            .map((a: string) => Observable.forkJoin(hasAsDependency.map((m: ModuleAndUrl) => UpdateVersionAndPushModule.updatePackageInModule(mod, m)))).switch()
                            .subscribe((vals: string[]) => {
                                    logv(mod.module, "Done");
                                    mod.fetchedRepo = true;
                                },
                                (error: any) => {
                                    loge("Error", error);
                                    mod.hadError = true;
                                    mod.stopProcessing = true;
                                    updateModuleAndVersionItActor.next(mod);
                                    loge(error);
                                },
                                () => {
                                    mod.stopProcessing = true;
                                    updateModuleAndVersionItActor.next(mod);
                                }
                            );
                    }
                    if (mod.stopProcessing) {
                        hasAsDependency.forEach(m => {
                            try {
                                delete m.dependencies[mod.module];
                                if (Object.keys(m.dependencies).length == 0) {
                                    updateModuleAndVersionItActor.next(m);
                                }
                            } catch (err) {
                                loge("Error in update module and versioning it", err);
                            }
                        });
                    }
                    if (allInspected(dependencies)) {
                        updateModuleAndVersionItActor.complete();
                    }
                }
            },
            (error: any) => {
                loge("Error", error);
            },
            () => {
                logi("We're done here.");
            }
        );
    }

    public next(mod: ModuleAndUrl) {
        this.updateModuleAndVersionItActor.next(mod);
    }

    private static npmInstallGitCommitAndVersionitModule(mod: ModuleAndUrl, dependencies: Map<string, ModuleAndUrl>): Observable<string> {
        if (mod.packageJsonChanged) {
            logw("Updating package.json for", mod.module);
            fs.writeFileSync(mod.repoDir + '/package.json', JSON.stringify(mod.packageJson, null, 4));
        }
        const runAndUpdate = (cmd: string): Observable<string> => {
            mod.currentCommand = cmd;
            printDependencyMap(dependencies, true, "NPM install, versionit and push any package.json updated modules");
            return runCommand(cmd, mod.repoDir, mod);
        };

        console.log("PFB:", mod.prepForBuild, "\nBuild:", mod.build, "\nVAP:", mod.versionAndPush);
        console.log(">>", mod.prepForBuild.concat(mod.build).concat(mod.versionAndPush));
        console.log(">>>", mod.prepForBuild.concat(mod.build).concat(mod.versionAndPush).map(v =>
            v.condition ? "if " + v.condition + "; then " + v.cmd + "; fi"
                : v.cmd));

        // Concatenate the prep build, build and version push
        return (
            mod.prepForBuild.concat(mod.build).concat(mod.versionAndPush)
        )
        // Change the command if there is a conditional
        .map(v =>
            v.condition ? "bash -c 'if " + v.condition + "; then " + v.cmd + "; fi'"
                        : v.cmd
        )
        // Chain all the observables together using a mergeMap
        .reduce((previousValue: Observable<string>, currentValue: string, currentIndex: number) => previousValue.mergeMap(ss => runAndUpdate(currentValue)), Observable.of(""))
        // .reduceRight<Observable<string>(((previousValue, currentValue, i, arr) => previousValue.mergeMap(ss => runAndUpdate(currentValue))), Observable.of(""))
        // After all is done, fetch the latest version for the module
        .mergeMap(s => getModuleLatestVersion(mod))
        // Return the latest version
        .map(a => a.latestVersion);
    };

    static updatePackageInModule(dep: ModuleAndUrl, mod: ModuleAndUrl): Observable<string> {
        if (semver.lt(mod.dependencies[dep.module].version, dep.latestVersion)) {
            return Observable.create((observer: Observer<string>) => {
                logw("Updating ", dep.module, "in", mod.module, "=>", dep.latestVersion, "[" + mod.dependencies[dep.module].version + "]");
                mod.packageJsonChanged = true;
                if (!mod.packageJson) {
                    mod.packageJson = JSON.parse(fs.readFileSync(mod.repoDir + '/package.json'));
                }
                const pj = mod.packageJson;
                const version = (dep.url.startsWith("http") ? dep.module + "-" : "") + dep.latestVersion;
                const url = (dep.url.startsWith("http") ? "" : "ssh://") + dep.url;
                depLists.forEach(l => {
                    if (pj[l] && pj[l][dep.module]) {
                        pj[l][dep.module] = "git+" + url + "#" + version;
                    }
                });
                observer.next(dep.module);
                observer.complete();
            });
        } else {
            return Observable.from([]);
        }
    };
}