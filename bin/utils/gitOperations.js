"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var print_1 = require("./print");
var Observable_1 = require("rxjs/Observable");
var semver = require("semver");
var loge = print_1.Print.loge;
var logw = print_1.Print.logw;
var runCommand_1 = require("./runCommand");
var runCommand = runCommand_1.RunCommand.runCommand;
var Git = /** @class */ (function () {
    function Git() {
    }
    Git.getModuleLatestVersion = function (a) {
        return runCommand('git ls-remote -t ' + a.url, '.', a) //Use git ls-remote to get all the tags for a repo
            .catch(function (err, caught) {
            loge("Could not get git tags for " + a.url);
            a.latestVersion = "0.0.0";
            return Observable_1.Observable.of("0.0.0");
        })
            .map(function (ll) {
            if (ll != "0.0.0") {
                var lines = ll.split("\n")
                    .filter(function (l) { return !!l; }) // Get rid of empty lines
                    .map(function (l) { return l.split("\t")[1].substr("refs/tags/".length); })
                    .filter(function (l) { return semver.valid(l); })
                    .sort(function (a, b) { return semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0; });
                if (lines.length > 0) {
                    a.latestVersion = lines[0];
                }
            }
            return a;
        });
    };
    ;
    Git.isGitMasterAheadOfTag = function (tag, dir, playground, mod) {
        if (mod && playground[mod.module] && playground[mod.module].ignoreAheadOfMaster) {
            logw("Ignoring ahead of master");
            return Observable_1.Observable.from([false]);
        }
        return Observable_1.Observable.forkJoin([
            Git.getGitCommitOfTag(tag, dir, mod),
            Git.getGitCommitOfTag("master", dir, mod),
        ]).mergeMap(function (tags) {
            if (tags[0] == tags[1]) {
                return Observable_1.Observable.of(false);
            }
            return runCommand('git whatchanged -n 1 ' + tags[0] + ".." + tags[1], dir, mod).map(function (s) { return s.trim().length == 0; });
        });
    };
    ;
    Git.isGitDirectoryDirty = function (dir) {
        return runCommand("git status --porcelain", dir)
            .map(function (s) { return s != ""; });
    };
    ;
    Git.isGitDirectoryDirtyOrPackageChanged = function (mod) {
        return Observable_1.Observable.forkJoin([
            Git.isGitDirectoryDirty(mod.repoDir)
                .do(function (s) { return console.log("Is git dir dirty:", mod.module, s); }),
            Observable_1.Observable.of(mod.packageJsonChanged)
                .do(function (s) { return console.log("Is package json changed:", mod.module, s); })
        ]).map(function (val) { return val.some(function (i) { return i; }); });
    };
    ;
    Git.getGitCommitOfTag = function (tag, dir, mod) {
        var cmd = "git rev-list -n 1 " + tag;
        return runCommand(cmd, dir, mod).map(function (a) { return a.trim(); });
    };
    Git.getVersionFromGitString = function (ver) {
        return ver.substring(ver.indexOf("#") + 1);
    };
    Git.getGitRepoFromGitString = function (ver) {
        return ver.substring("git+ssh://".length, ver.indexOf("#"));
    };
    Git.loadPackageJsonFromGit = function (repo, version) {
        return runCommand("git archive --remote=" + repo + " " + version + " package.json | tar xfO - ", "./");
    };
    return Git;
}());
exports.Git = Git;
//# sourceMappingURL=gitOperations.js.map