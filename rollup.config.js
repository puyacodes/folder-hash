const commonjs = require('@rollup/plugin-commonjs');
const resolve = require('@rollup/plugin-node-resolve');
const json = require('@rollup/plugin-json');
const terser = require('@rollup/plugin-terser');
const del = require('rollup-plugin-delete');

module.exports = {
    input: "src/index.js",
    plugins: [
        del({ targets: 'dist/*' }),
        resolve(),
        terser(),
        commonjs(),
        json(),
    ],
    output: {
        file: "./dist/index.js",
        format: "cjs",
    }
};