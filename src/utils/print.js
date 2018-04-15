"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var moduleAndUrl_1 = require("../domain/moduleAndUrl");
var clear = require('clear');
var colors = require("colors");
var Print = /** @class */ (function () {
    function Print() {
    }
    Print.logv = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        console.log(colors.verbose(a.join(" ")));
    };
    Print.logi = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        console.log(colors.info(a.join(" ")));
    };
    Print.logw = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        console.log(colors.warn(a.join(" ")));
    };
    Print.loge = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        console.log(colors.error(a.join(" ")));
    };
    Print.maxLength = function (values) {
        return values && values.length > 0 ? values.sort(function (a, b) { return a.module.length > b.module.length ? -1 : 1; })[0].module.length : 0;
    };
    Print.padRight = function (val, theMaxLength) {
        if (theMaxLength < val.length) {
            return val;
        }
        var len = theMaxLength - val.length;
        var pad = '';
        while (len--) {
            pad += ' ';
        }
        return val + pad;
    };
    Print.printDependencyMap = function (map, clearScreen, message) {
        var padRight = Print.padRight;
        var moduleList = moduleAndUrl_1.ModuleAndUrl.modulesMapToList(map);
        var theMaxLength = Print.maxLength(moduleList);
        var sortedToName = moduleList.sort(function (a, b) { return a.module.localeCompare(b.module); });
        if (clearScreen) {
            clear(false);
            console.log('\x1Bc');
        }
        if (message) {
            console.log(message + "\n");
        }
        console.log("TR: ", Print.currentTotalRunning);
        var maxDeps = 0;
        sortedToName.forEach(function (mm) {
            var ml = Object.keys(mm.dependencies).length;
            maxDeps = maxDeps < ml ? ml : maxDeps;
        });
        var maxDepsPad = ("" + maxDeps).length;
        var modulesLengthPad = ("" + (map.keys.length - 1)).length;
        var text = padRight(" ", theMaxLength) + padRight(" ", maxDepsPad) + padRight(" ", modulesLengthPad) + "    ";
        var i = 0;
        text += sortedToName.map(function (mm) { return padRight("" + i++, modulesLengthPad); }).join("|");
        Print.logw(text);
        i = 0;
        sortedToName.forEach(function (m) {
            var deps = '|' + sortedToName
                .map(function (mm) { return m.dependencies.hasOwnProperty(mm.module) ? "x" : mm.module == m.module ? "*" : " "; })
                .map(function (a) { return padRight(a, modulesLengthPad); })
                .join("|");
            text = padRight(m.module, theMaxLength) + "[" + padRight("" + Object.keys(m.dependencies).length, maxDepsPad) + "] " + padRight("" + i++, modulesLengthPad) + deps + " " + m.currentCommand;
            if (m.hadError) {
                Print.loge(text);
            }
            else if (m.stopProcessing) {
                Print.logi(text);
            }
            else if (m.packageJsonChanged) {
                Print.logv(text);
            }
            else if (!m.fetchedRepo) {
                Print.logw(text);
            }
            else {
                Print.logv(text);
            }
        });
    };
    ;
    Print.currentTotalRunning = 0;
    return Print;
}());
exports.Print = Print;
//# sourceMappingURL=print.js.map