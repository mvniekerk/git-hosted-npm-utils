#!/usr/bin/env node
import {Observable} from "rxjs/Rx";

const fs = require("fs");
const semver = require("semver");
const inquirer = require("inquirer");
const commander = require("commander");
const semverDiff = require("semver-diff");
import {Print} from '../utils/print';
import {ModuleAndUrl} from '../domain/moduleAndUrl';
import {RunCommand} from '../utils/runCommand';

const logi = Print.logi;
const loge = Print.loge;
const logw = Print.logw;
const logv = Print.logv;
const padRight = Print.padRight;

commander
    .version('0.1.8')
    .option('-a --all', 'Automatically update a git module regardless of version')
    .option('-d --dev', 'Update dev dependencies also')
    .parse(process.argv);

if (commander.all) {
    logv("Automatically updating all git modules");
}

const depLists = ['dependencies', 'devDependencies', 'peerDependencies'];
if (commander.dev) {
    depLists.push('devDependencies');
}

const flatMap = (f,xs) =>
    xs.reduce((acc,x) =>
        acc.concat(f(x)), []);

RunCommand.startListeningToCommands(5);

//Map that has the module name with its description
const dependencies = new Map<string, ModuleAndUrl>(
    flatMap(depList => {
        const dependenciesObj = JSON.parse(fs.readFileSync("package.json"))[depList];
        let list = [];
        for (const dep in dependenciesObj) {
            if (dependenciesObj.hasOwnProperty(dep)) {
                const ver: string = dependenciesObj[dep];
                if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                    const m = new ModuleAndUrl();
                    m.module = dep;
                    m.url = ver.substring("git+ssh://".length, ver.indexOf("#"));
                    m.version = ver.substring(ver.indexOf("#") + 1);
                    m.depList = depList;
                    list.push([dep, m]);
                }
            }
        }
        return list;
    }, depLists)
);

//Get all the values of the map
const values: ModuleAndUrl[] = Array.from(dependencies.values());

const maxLength = values && values.length > 0 ? values.sort((a, b) => a.module.length > b.module.length ? -1 : 1)[0].module.length : 0;

Observable.forkJoin(
    values.map(a =>
        RunCommand.runCommand('git ls-remote -t ' + a.url, './')
            .map((output: string) =>
                output
                    .split('\n')
                    .filter(l => l) //Get rid of empty lines
                    .map((l: string) => l.split("\t")[1].substr("refs/tags/".length))
                    .filter((l: string) => semver.valid(l))
                    .sort((a: string, b: string) => semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0)
            )
            .map(l => l.length > 0 ? l[0] : '0.0.0')
            .onErrorResumeNext(e => '0.0.0')
            .filter(l => l && l != '')
            .do(v => a.latestVersion = v)
            .map(v => a)
            .do(m => {
                if (m.latestVersion != m.version) {
                    logw(padRight(m.module, maxLength) + " :R ", m.latestVersion, "L:", m.version);
                } else {
                    logv(padRight(m.module, maxLength) + " :R ", m.latestVersion, "L:", m.version);
                }
            })
    )
)
.subscribe((a: ModuleAndUrl[]) => {
    const auto = a.filter((aa: ModuleAndUrl) => {   //The auto list are the modules that have the same min/maj as the latest, but build is bigger on repo
        if (semver.valid(aa.latestVersion)
            && semver.valid(aa.version)) {
            if (semver.gt(aa.latestVersion, aa.version)
                && (commander.all || ["patch", "null"].some((v: string) => v == semverDiff(aa.latestVersion, aa.version)))) {

                logw("Automatically updating " + aa.module + " to " + aa.latestVersion);
                return true;
            }
        } else {
            loge("Could not parse version ", aa.version, " or ", aa.latestVersion);
        }
        return false;
    });

    const nonAutoChoices = a
        .filter(aa => !auto.find(bb => bb.module == aa.module))     //Invert auto list
        .filter(aa => semver.valid(aa.latestVersion)
            && semver.valid(aa.version)
            && semver.gt(aa.latestVersion, aa.version)
        )                                                                               //Only add those whose values are gt
        .map(aa => {                                                          //Map from ModuleAndUrl to an Inquirer prompt
            return {
                type: 'confirm',
                name: aa.module,
                message: 'Update ' + aa.module + ' : ' + aa.version + " -> " + aa.latestVersion
            };
        });

    inquirer.prompt(nonAutoChoices).then((answers) => {     //Ask the user to update the modules that have a greater version than just a build bump
        const pj = JSON.parse(fs.readFileSync("package.json"));

        const updatePackageJson = function (module: ModuleAndUrl) {
            logi("package.json: Updating ", module.module);
            const version = (module.url.startsWith("http") ? module.module + "-" : "") + module.latestVersion;
            const url = (module.url.startsWith("http") ? "" : "ssh://") + module.url;
            depLists.forEach(l => {
                if (pj[l] && pj[l][module.module]) {
                    pj[l][module.module] = "git+" + url + "#" + version;
                }
            })
        };

        //The prompt return is { "key" : true/false, ... }
        Object.keys(answers).filter(a => answers[a]).forEach(a => { //Get all the keys that is to be updated
            updatePackageJson(dependencies[a]);
        });
        auto.forEach(a => {
            updatePackageJson(a);
        });
        fs.writeFileSync("package.json", JSON.stringify(pj, null, 4));  //Write the file
    });
});