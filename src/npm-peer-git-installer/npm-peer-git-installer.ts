#!/usr/bin/env node
import {BehaviorSubject} from "rxjs/Rx";

const semver = require("semver");
const commander = require("commander");
const clear = require('clear');
const npm = require('enpeem');
import {RunCommand} from '../utils/runCommand';
import {Print} from '../utils/print';
import {Git} from '../utils/gitOperations';

const logi = Print.logi;
const loge = Print.loge;
const logv = Print.logv;
const logw = Print.logw;
const padRight = Print.padRight;
const getVersionFromGitString = Git.getVersionFromGitString;
const getGitRepoFromGitString = Git.getGitRepoFromGitString;
const loadPackageJsonFromGit = Git.loadPackageJsonFromGit;

commander
    .version('0.1.8')
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-p --print', 'Print packages when state changes')
    .parse(process.argv);

const packages: { module: string, loaded: boolean, version: string, url: string, handled: boolean }[] = [];

const printPackages = () => {
    if (!commander.print) {
        return;
    }
    const longestName       = packages.reduce((a, b, i) => b.module.length > a  ? b.module.length   : a, "Package".length) + 1;
    const longestVersion    = packages.reduce((a, b, i) => b.version.length > a ? b.version.length  : a, "Version".length) + 1;
    const longestGit        = packages.reduce((a, b, i) => b.url.length > a     ? b.url.length      : a, "Git".length) + 1;
    const padFalse          = "L".length + 1;

    logi(padRight("Package", longestName) + "| " + padRight("L", padFalse) + "| " + padRight("Version", longestVersion) + "| " + padRight("Git", longestGit));
    packages
        .sort((a, b) => a.module > b.module ? 1 : -1)
        .forEach(a => {
            logi(padRight(a.module, longestName) + "| " + padRight(a.loaded ? "Y" : a.handled ? "H" : " ", padFalse) + "| " + padRight(a.version, longestVersion) + "| " + padRight(a.url, longestGit));
        });
};

const installDependencies = () => {
    const dependencies = packages.map(a => a.module + '@' + (!!a.url ? a.url : a.version));
    logv("Dependencies:\n\t" + dependencies.join("\n\t"));
    npm.install({
        dir: "./",
        dependencies: dependencies,
        'cache-min': 999999999
    }, (e) => {
        if (e) {
            loge("!!:", e);
        } else {
            logi("Done");
        }
    });
};

const loadPackageActor: BehaviorSubject<string> = new BehaviorSubject("");
loadPackageActor.filter(i => !!i).subscribe(a => {
    const p = packages.find(aa => aa.module == a);

    if (!p) {
        loge("Could not find " + a);
        return;
    }

    const repo = getGitRepoFromGitString(p.url);
    const version = getVersionFromGitString(p.url);

    loadPackageJsonFromGit(repo, version).subscribe(a => parsePackageJson(a));
});

const parsePackageJson = (json: string) => {
    clear();
    printPackages();
    const val = JSON.parse(json);

    const me = packages.find(a => a.module == val["name"]);
    if (me && me.handled) {
        logi(val["name"] + " : Skipping");
        return;
    }
    if (me) {
        me.handled = true;
    }
    logw("Loading: ", val["name"]);

    const peerDeps = val["peerDependencies"];
    for (const key in peerDeps) {
        if (peerDeps.hasOwnProperty(key)) {
            const ver = peerDeps[key];
            if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                logv(key + " : Checking");
                const h = packages.find(a => a.module == key);
                const version = getVersionFromGitString(ver);
                if (!h) {
                    packages.push({loaded: false, handled: false, module: key, url: ver, version: version});
                    loadPackageActor.next(key);
                } else {
                    if (semver.lt(h.version, version)) {
                        h.version = version;
                    }
                }
            } else {
                const h = packages.find(a => a.module == key);
                if (!h) {
                    packages.push({loaded: true, handled: true, module: key, url: "", version: ver})
                } else {
                    const inList = h.version.startsWith("^") ? h.version.substr(1) : h.version;
                    const current = ver.startsWith("^") ? ver.substr(1) : ver;
                    if (semver.lt(inList, current)) {
                        h.version = ver;
                    }
                }
            }
        }
    }

    if (me) {
        me.loaded = true;
    }

    installDependencies();
};

RunCommand.startListeningToCommands(5);
RunCommand.runCommand("cat package.json", "./").subscribe(a => parsePackageJson(a));
