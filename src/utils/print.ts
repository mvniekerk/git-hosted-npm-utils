import {ModuleAndUrl} from '../domain/moduleAndUrl';
const clear = require('clear');
const colors = require("colors");

export class Print {
    public static currentTotalRunning = 0;

    public static logv(...a:any[]) {
        console.log(colors.verbose(a.join(" ")));
    }

    public static logi(...a:any[]) {
        console.log(colors.info(a.join(" ")));
    }

    public static logw(...a:any[]) {
        console.log(colors.warn(a.join(" ")));
    }

    public static loge(...a:any[]) {
        console.log(colors.error(a.join(" ")));
    }

    public static maxLength(values:ModuleAndUrl[]) {
        return values && values.length > 0 ? values.sort((a:ModuleAndUrl, b:ModuleAndUrl) => a.module.length > b.module.length ? -1 : 1)[0].module.length : 0;
    }

    public static padRight(val:string, theMaxLength:number): string {
        if (theMaxLength < val.length) {
            return val;
        }
        let len = theMaxLength - val.length;
        let pad = '';
        while (len--) {
            pad += ' ';
        }
        return val + pad;
    }

    public static printDependencyMap(map:Map<string, ModuleAndUrl>, clearScreen:boolean, message?:string) {
        const padRight = Print.padRight;
        const moduleList = ModuleAndUrl.modulesMapToList(map);
        const theMaxLength = Print.maxLength(moduleList);
        const sortedToName = moduleList.sort((a:ModuleAndUrl, b:ModuleAndUrl) => a.module.localeCompare(b.module));
        if (clearScreen) {
            clear(false);
            console.log('\x1Bc');
        }
        if (message) {
            console.log(message + "\n");
        }

        console.log("TR: ", Print.currentTotalRunning);

        let maxDeps = 0;
        sortedToName.forEach(mm => {
            const ml = Object.keys(mm.dependencies).length;
            maxDeps = maxDeps < ml ? ml : maxDeps;
        });
        const maxDepsPad = ("" + maxDeps).length;
        const modulesLengthPad = ("" + (map.keys.length-1)).length;

        let text = padRight(" ", theMaxLength) + padRight(" ", maxDepsPad) + padRight(" ", modulesLengthPad) +  "    ";
        let i = 0;
        text += sortedToName.map(mm => padRight("" + i++, modulesLengthPad)).join("|");
        Print.logw(text);

        i = 0 ;
        sortedToName.forEach((m:ModuleAndUrl) => {
            const deps = '|' + sortedToName
                .map((mm:ModuleAndUrl) => m.dependencies.hasOwnProperty(mm.module) ? "x" : mm.module == m.module ? "*" : " ")
                .map((a:string) => padRight(a, modulesLengthPad))
                .join("|");
            text = padRight(m.module, theMaxLength) + "[" + padRight("" + Object.keys(m.dependencies).length, maxDepsPad) + "] " + padRight("" + i++, modulesLengthPad) + deps + " " + m.currentCommand;
            if (m.hadError) {
                Print.loge(text);
            } else if (m.stopProcessing) {
                Print.logi(text);
            } else if (m.packageJsonChanged) {
                Print.logv(text);
            } else if (!m.fetchedRepo){
                Print.logw(text);
            } else {
                Print.logv(text);
            }
        });
    };
}
