var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: {
        "cascading-git-update": "./src/cascading-git-updater/npm-cascading-git-update.ts",
        "recursive-peer-deps": "./src/npm-peer-git-installer/npm-peer-git-installer.ts",
        "updategitmodules": "./src/npm-git-repo-module-updater/npm-git-repo-module-updater.ts",
        "peers-as-ng-externals": "./src/npm-peers-as-ng-externals/npm-peers-as-ng-externals.ts"
    },
    output: {
        publicPath: "/js/",
        path: path.join(__dirname, '/bin/'),
        filename: '[name].js'
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: [".ts", ".tsx", ".js"]
    },
    devtool: 'source-map', // if we want a source map
    module: {
        rules: [
            // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
            {test: /\.tsx?$/, loader: "ts-loader"}
        ]
    },
    externals: {
        node: 'node',
        fs: 'fs',
        child_process: 'child_process',
        readline: 'readline'
    },
    plugins: [
        new webpack.BannerPlugin({banner: '#!/usr/bin/env node', raw: true})
    ]
}