import {ModuleAndUrl} from '../domain/moduleAndUrl';
import {Print} from './print';
import {Observable} from 'rxjs/Observable';

const semver = require("semver");
const loge = Print.loge;
const logw = Print.logw;

import {RunCommand as Rc} from './runCommand';
const runCommand = Rc.runCommand;

export class Git {
    public static getModuleLatestVersion(a:ModuleAndUrl) : Observable<ModuleAndUrl> {
        return runCommand('git ls-remote -t ' + a.url, '.', a) //Use git ls-remote to get all the tags for a repo
            .catch((err: any, caught: Observable<string>) => {
                loge("Could not get git tags for " + a.url);
                a.latestVersion = "0.0.0";
                return Observable.of("0.0.0");
            })
            .map((ll:string) => {
                if (ll != "0.0.0") {
                    let lines = ll.split("\n")
                        .filter(l => !!l)   // Get rid of empty lines
                        .map((l:string) => l.split("\t")[1].substr("refs/tags/".length))
                        .filter((l:string) => semver.valid(l))
                        .sort((a:string, b:string) => semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0);
                    if (lines.length > 0) {
                        a.latestVersion = lines[0];
                    }
                }
                return a;
            });
    };

    public static getGitCommitOfTag = function (tag: string, dir: string, mod?: ModuleAndUrl): Observable<string> {
        const cmd = "git rev-list -n 1 " + tag;
        return runCommand(cmd, dir, mod).map((a: string) => a.trim());
    };

    public static isGitMasterAheadOfTag(tag: string, dir: string, playground: Map<string, ModuleAndUrl>, mod?: ModuleAndUrl): Observable<boolean> {
        if (mod && playground[mod.module] && playground[mod.module].ignoreAheadOfMaster) {
            logw("Ignoring ahead of master");
            return Observable.from([false]);
        }
        return Observable.forkJoin([
            Git.getGitCommitOfTag(tag, dir, mod),
            Git.getGitCommitOfTag("master", dir, mod),
        ]).mergeMap((tags: string[]) => {
            if (tags[0] == tags[1]) {
                return Observable.of(false);
            }
            return runCommand('git whatchanged -n 1 ' + tags[0] + ".." + tags[1], dir, mod).map((s: string) => s.trim().length == 0);
        });
    };

    public static isGitDirectoryDirty(dir: string): Observable<boolean> {
        return runCommand("git status --porcelain", dir)
            .map(s => s != "")
    };

    public static isGitDirectoryDirtyOrPackageChanged(mod: ModuleAndUrl): Observable<boolean> {
        return Observable.forkJoin([
            Git.isGitDirectoryDirty(mod.repoDir)
                .do(s => console.log("Is git dir dirty:", mod.module, s))
            ,
            Observable.of(mod.packageJsonChanged)
                .do(s => console.log("Is package json changed:", mod.module, s))
        ]).map((val: boolean[]) => val.some(i => i));
    };
}