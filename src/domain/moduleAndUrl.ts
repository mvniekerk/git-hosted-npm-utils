const fs = require("fs");

export class CommandAndCondition {
    cmd: string;
    condition: string;
}

export class ModuleAndUrl {
    module:string;
    url:string;
    version:string;
    latestVersion:string;
    depList:string;
    dependencies = new Map<string, ModuleAndUrl>();
    processed:boolean = false;
    stopProcessing:boolean = false;
    hadError:boolean = false;
    fetchedRepo:boolean = false;
    fetchingRepo:boolean = false;
    repoDir:string;
    packageJson:any = "";
    packageJsonChanged:boolean = false;
    currentCommand:string = "";
    ignoreAheadOfMaster:boolean = false;
    prepForBuild: CommandAndCondition[];
    build: CommandAndCondition[];
    versionAndPush: CommandAndCondition[];
    errors: string;

    static depLists = ['dependencies', 'peerDependencies', 'devDependencies'];

    public static modulesMapToList(map: Map<string, ModuleAndUrl>): ModuleAndUrl[] {
        return Object.keys(map).map(k => map[k]);
    };

    static updateFromConf(
        m:ModuleAndUrl, playground: Map<String, ModuleAndUrl>,
        defaultCommands: {prepForBuild: CommandAndCondition[], build: CommandAndCondition[], versionAndPush: CommandAndCondition[]}
    ) {
        if (m && playground[m.module]) {
            m.ignoreAheadOfMaster = playground[m.module].ignoreAheadOfMaster;

            m.prepForBuild = playground[m.module].prepForBuild;
            m.build = playground[m.module].build;
            m.versionAndPush = playground[m.module].versionAndPush;

            m.prepForBuild      = m.prepForBuild != null    ? m.prepForBuild    : defaultCommands.prepForBuild;
            m.build             = m.build != null           ? m.build           : defaultCommands.build;
            m.versionAndPush    = m.versionAndPush          ? m.versionAndPush  : defaultCommands.versionAndPush;
        } else {
            m.prepForBuild = defaultCommands.prepForBuild;
            m.build = defaultCommands.build;
            m.versionAndPush = defaultCommands.versionAndPush;
        }
    };

    public static checkForGitDependencies(
        defaultCommands: {prepForBuild: CommandAndCondition[], build: CommandAndCondition[], versionAndPush: CommandAndCondition[]},
        deps: Map<string, ModuleAndUrl>, mainModules: Map<string, ModuleAndUrl>, dir?:string
    ) {
        dir = dir ? dir : "";
        ModuleAndUrl.depLists.forEach((depList: string) => {

            //Read the package.json file
            const dependenciesObj = JSON.parse(fs.readFileSync(dir + "package.json"))[depList];

            //Go through the dependencies and get those that are git repositories
            for (const dep in dependenciesObj) {
                if (dependenciesObj.hasOwnProperty(dep)) {
                    const ver: string = dependenciesObj[dep];
                    if (ver.startsWith("git+ssh://") && ver.indexOf("#") > 0) {
                        const m = new ModuleAndUrl();
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

    public static allInspected(dependencies: Map<string, ModuleAndUrl>): boolean {
        return !ModuleAndUrl.modulesMapToList(dependencies).some(m => !m.processed);
    };
}