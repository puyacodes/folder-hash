const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const del = require('rollup-plugin-delete');

module.exports = {
    input: "src/index.js",
    plugins: [
        del({ targets: 'dist/*' }),
        commonjs(),
        json(),
    ],
    output: {
        file: "./dist/index.js",
        format: "cjs",
    }
};