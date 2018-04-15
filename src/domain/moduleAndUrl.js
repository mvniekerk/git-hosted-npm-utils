"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var CommandAndCondition = /** @class */ (function () {
    function CommandAndCondition() {
    }
    return CommandAndCondition;
}());
exports.CommandAndCondition = CommandAndCondition;
var ModuleAndUrl = /** @class */ (function () {
    function ModuleAndUrl() {
        this.dependencies = new Map();
        this.processed = false;
        this.stopProcessing = false;
        this.hadError = false;
        this.fetchedRepo = false;
        this.fetchingRepo = false;
        this.packageJson = "";
        this.packageJsonChanged = false;
        this.currentCommand = "";
        this.ignoreAheadOfMaster = false;
    }
    ModuleAndUrl.modulesMapToList = function (map) {
        return Object.keys(map).map(function (k) { return map[k]; });
    };
    ;
    ModuleAndUrl.updateFromConf = function (m, playground, defaultCommands) {
        if (m && playground[m.module]) {
            m.ignoreAheadOfMaster = playground[m.module].ignoreAheadOfMaster;
            m.prepForBuild = playground[m.module].prepForBuild;
            m.build = playground[m.module].build;
            m.versionAndPush = playground[m.module].versionAndPush;
            m.prepForBuild = m.prepForBuild != null ? m.prepForBuild : defaultCommands.prepForBuild;
            m.build = m.build != null ? m.build : defaultCommands.build;
            m.versionAndPush = m.versionAndPush ? m.versionAndPush : defaultCommands.versionAndPush;
        }
        else {
            m.prepForBuild = defaultCommands.prepForBuild;
            m.build = defaultCommands.build;
            m.versionAndPush = defaultCommands.versionAndPush;
        }
    };
    ;
    ModuleAndUrl.checkForGitDependencies = function (defaultCommands, deps, mainModules, dir) {
        dir = dir ? dir : "";
        ModuleAndUrl.depLists.forEach(function (depList) {
            //Read the package.json file
            var dependenciesObj = JSON.parse(fs.readFileSync(dir + "package.json"))[depList];
            //Go through the dependencies and get those that are git repositories
            for (var dep in dependenciesObj) {
                if (dependenciesObj.hasOwnProperty(dep)) {
                    var ver = dependenciesObj[dep];
                    if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                        var m = new ModuleAndUrl();
                        // m.module = dep.trim();
                        m.module = dep;
                        m.url = ver.substring("git+ssh://".length, ver.indexOf("#"));
                        m.version = ver.substring(ver.indexOf("#") + 1);
                        m.depList = depList;
                        ModuleAndUrl.updateFromConf(m, mainModules, defaultCommands);
                        deps[dep] = m;
                    }
                }
            }
        });
    };
    ;
    ModuleAndUrl.allInspected = function (dependencies) {
        return !ModuleAndUrl.modulesMapToList(dependencies).some(function (m) { return !m.processed; });
    };
    ;
    ModuleAndUrl.depLists = ['dependencies', 'peerDependencies', 'devDependencies'];
    return ModuleAndUrl;
}());
exports.ModuleAndUrl = ModuleAndUrl;
//# sourceMappingURL=moduleAndUrl.js.map