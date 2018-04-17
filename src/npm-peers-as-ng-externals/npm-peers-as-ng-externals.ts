import {Observable, BehaviorSubject} from "rxjs/Rx";
const fs = require("fs");
const semver = require("semver");
const commander = require("commander");
const clear = require('clear');

import {Print} from '../utils/print';
import {RunCommand} from '../utils/runCommand';
import {Git} from '../utils/gitOperations';

const logi = Print.logi;
const loge = Print.loge;
const logv = Print.logv;
const logw = Print.logw;
const getVersionFromGitString = Git.getVersionFromGitString;
const getGitRepoFromGitString = Git.getGitRepoFromGitString;
const padRight = Print.padRight;
const runCommand = RunCommand.runCommand;

commander
    .version('0.1.8')
    // .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-p --print', 'Print packages when state changes')
    .parse(process.argv);

const packages:{name: string, loaded: boolean, version: string, git: string, handled: boolean}[] = [];
RunCommand.startListeningToCommands(5);

const printPackages = () => {
    if (!commander.print) {
        return;
    }
    const longestName       = packages.reduce((a, b, i) => b.name.length > a ? b.name.length : a, "Package".length) + 1;
    const longestVersion    = packages.reduce((a, b, i) => b.version.length > a ? b.version.length : a, "Version".length) + 1;
    const longestGit        = packages.reduce((a, b, i) => b.git.length > a ? b.git.length : a, "Git".length) + 1;
    const padFalse          = "L".length + 1;

    logi(padRight("Package", longestName) + "| " +  padRight("L", padFalse) + "| "+ padRight("Version", longestVersion) + "| " + padRight("Git", longestGit));
    packages.sort((a, b) => a.name > b.name ? 1 : -1).forEach(a => {
        logi(padRight(a.name, longestName) + "| " + padRight(a.loaded ? "Y" : a.handled ? "H" : " ", padFalse) + "| " + padRight(a.version, longestVersion) + "| " + padRight(a.git, longestGit));
    });
};

const installDependencies = () => {
    const dependencies = packages.map(a => a.name + '@' + (!!a.git ? a.git : a.version));
    logv("Dependencies:\n\t" + dependencies.join("\n\t"));

    fs.exists("ng-package.json", (exists) => {
        (
            !exists
                ?
                    Observable.merge(
                        Observable.of("ng-package.json")
                            .map(fn => {
                                const template =  '{\n' +
                                    '    "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",\n' +
                                    '    "lib": {\n' +
                                    '        "entryFile": "public_api.ts",\n' +
                                    '        "externals": {\n' +
                                    '        }\n' +
                                    '    }\n' +
                                    '}';
                                fs.writeFileSync(fn , template);
                                return "";
                            }),
                        Observable.of("public_api.ts")
                            .map(fn => {
                                fs.writeFileSync(fn, "export * from './src/app/app.module';\n");
                                return "";
                            })
                    ).last()
                :   Observable.of("")
        )
        .mergeMap(a => runCommand("cat ng-package.json", "./"))
        .map(a => JSON.parse(a))
        .map(a => {
            const lib = a['lib'];
            if (!lib['externals']) {
                lib['externals'] = {};
            }
            const externals: {[p: string]: string} = lib['externals'];
            packages.forEach(p => {
                if (!externals[p.name]) {
                    externals[p.name] = p.name;
                }
                if (p.git && !externals[p.name + '/dist/' + p.name]) {
                    externals[p.name + '/dist/' + p.name] = p.name + '/dist/' + p.name;
                }
                if (p.git && !externals[p.name + '/public_api']) {
                    externals[p.name + '/public_api'] = p.name + '/dist/' + p.name;
                }
            });
            return a;
        })
        .subscribe(a => fs.writeFileSync('ng-package.json', JSON.stringify(a, null, 4)));
    });
};

const loadPackageJsonFromGit = (repo: string, version: string) => {
    runCommand("git archive --remote=" + repo + " " + version + " package.json | tar xfO - ", "./")
        .subscribe(a => parsePackageJson(a));
};

const loadPackageActor: BehaviorSubject<string> = new BehaviorSubject("");
loadPackageActor.subscribe(a => {
    if (!a) {
        return;
    }
    const p = packages.find(aa => aa.name == a);

    if (!p) {
        loge("Could not find " + a);
        return;
    }

    const repo = getGitRepoFromGitString(p.git);
    const version = getVersionFromGitString(p.git);

    loadPackageJsonFromGit(repo, version);
});

const parsePackageJson = (json: string) => {
    if (commander.print) {
        clear();
    }
    printPackages();
    const val = JSON.parse(json);

    const me = packages.find(a => a.name == val["name"]);
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
            const ver =  peerDeps[key];
            if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                logv(key + " : Checking");
                const h = packages.find(a => a.name == key);
                const version = getVersionFromGitString(ver);
                if (!h) {
                    packages.push({loaded: false, handled: false, name: key, git: ver, version: version});
                    loadPackageActor.next(key);
                } else {
                    if (semver.lt(h.version, version)) {
                        h.version = version;
                    }
                }
            } else {
                const h = packages.find(a => a.name == key);
                if (!h) {
                    packages.push({loaded: true, handled: true, name: key, git: "", version: ver})
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

    const count = packages.filter(a => !a.loaded || !a.handled).length;
    if (count == 0) {
        installDependencies();
    }
};

runCommand("cat package.json", "./").subscribe(a => parsePackageJson(a));
