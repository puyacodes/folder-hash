'use strict';

const { isSomeString, isString, isBool, isFunction, isObject, isSomeArray } = require("@locustjs/base");
const fs = require("fs");
const path = require("path");
const crypto = require('crypto');

function getFileMd5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => {
            hash.update(data);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex')); // Returns the MD5 hash as a hexadecimal string
        });

        stream.on('error', (err) => {
            reject(err);
        });
    });
}

function getMd5(input) {
    return crypto.createHash('md5').update(input).digest('hex');
}

class FolderNavigator {
    constructor(config) {
        this.config = Object.assign({
            excludeDirs: '',
            excludeFiles: ''
        }, config);

        if (!isString(this.config.excludeDirs)) {
            this.config.excludeDirs = [];
        } else {
            this.config.excludeDirs = this.config.excludeDirs.split(",").filter(isSomeString);
        }

        if (!isString(this.config.excludeFiles)) {
            this.config.excludeFiles = [];
        } else {
            this.config.excludeFiles = this.config.excludeFiles.split(",").filter(isSomeString);
        }
    }
    async _navigate(result, dir, callback, level = 0) {
        if (fs.existsSync(dir)) {
            const stat = fs.statSync(dir);

            if (stat && stat.isDirectory()) {
                result.name = level == 0 ? "" : path.parse(dir).base;

                let r = await callback({ name: result.name, fullPath: dir, dir: true, level, state: 0, node: result });

                if (isObject(r)) {
                    for (let key of Object.keys(r)) {
                        result[key] = r[key];
                    }
                }

                let list = fs.readdirSync(dir);

                list.sort();

                for (let i = 0; i < list.length; i++) {
                    const file = list[i];

                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);

                    if (stat && stat.isDirectory()) {
                        if (!this.config.excludeDirs.includes(file)) {
                            const r = await callback({ name: file, fullPath, dir: true, stat, level, state: 1, node: result });

                            if (r === undefined || (isBool(r) && r)) {
                                if (!result.dirs) {
                                    result.dirs = [];
                                }

                                const subdir = {};

                                await this._navigate(subdir, fullPath, callback, level + 1);

                                result.dirs.push(subdir);
                            }
                        }
                    } else {
                        if (!(this.config.excludeFiles.includes(file) || this.config.excludeFiles.includes(`*${path.parse(file).ext}`))) {
                            const r = await callback({ name: file, fullPath, dir: false, stat, level, state: 2, node: result });

                            if (r === undefined || (isBool(r) && r)) {
                                if (!result.files) {
                                    result.files = [];
                                }

                                result.files.push(file);
                            } else if (r !== undefined && r && !isBool(r)) {
                                if (!result.files) {
                                    result.files = [];
                                }

                                result.files.push(r);
                            }
                        }
                    }
                }

                r = await callback({ name: result.name, dir: true, level, state: 3, node: result });

                if (isObject(r)) {
                    for (let key of Object.keys(r)) {
                        result[key] = r[key];
                    }
                }
            }
        }
    }
    async navigate(dir, callback) {
        const result = {};

        if (!path.isAbsolute(dir)) {
            dir = path.join(process.cwd(), dir);
        }

        if (!isFunction(callback)) {
            callback = () => { };
        }

        await this._navigate(result, dir, callback);

        return result;
    }

}

class FolderUtil {
    static async getHash(dir, onProgress) {
        const fn = new FolderNavigator({
            excludeDirs: 'node_modules,.git,tests,packages,wwwroot'
        });
        if (!isFunction(onProgress)) {
            onProgress = () => { };
        }
        const callback = async (args) => {
            onProgress(args);

            const { name, fullPath, dir, state, node } = args;

            if (!dir) {
                return { name, hash: await getFileMd5(fullPath) }
            }

            if (state == 3) {
                let hashes = [];

                if (node.dirs && node.dirs.length) {
                    for (let _dir of node.dirs) {
                        hashes.push(_dir.hash);
                    }
                }
                if (node.files && node.files.length) {
                    for (let _file of node.files) {
                        hashes.push(_file.hash);
                    }
                }

                return { hash: hashes.length ? getMd5(hashes.join("")) : "" }
            }
        };

        const result = await fn.navigate(dir, callback);

        return result;
    }
    static async diff(dir1, dir2) {

    }
    static async syncFrom(fromDir, toDir, relTo) {
        let jsonFrom, jsonTo;

        if (isString(fromDir)) {
            jsonFrom = await FolderUtil.getHash(fromDir);
        } else if (isObject(fromDir)) {
            jsonFrom = fromDir;
        } else {
            throw `Invalid dir 1`
        }

        if (isString(toDir)) {
            jsonTo = await FolderUtil.getHash(toDir);
            relTo = !isSomeString(relTo) ? path.parse(toDir).dir: relTo;
        } else if (isObject(toDir)) {
            jsonTo = toDir;

            if (!isSomeString(relTo)) {
                throw `target relative path required`
            }
        } else {
            throw `Invalid dir 2`
        }
        
        let changes = [];

        function checkDir(from, to, relFrom, relTo) {
            const _relFrom = relFrom + (from.name ? "\\" + from.name: "");
            const _relTo = relTo + (to.name ? "\\" + to.name: "");

            if (isSomeArray(from.dirs)) {
                if (isSomeArray(to.dirs)) {
                    for (let subdirFrom of from.dirs) {
                        const subdirTo = to.dirs.find(d => d.name.toLowerCase() == subdirFrom.name.toLowerCase());

                        if (subdirTo) {
                            checkDir(subdirFrom, subdirTo, _relFrom, _relTo);
                        } else {
                            changes.push(`xcopy "${_relFrom}\\${subdirFrom.name}" "${_relTo}" /S/Q/Y`);
                        }
                    }
                } else {
                    changes.push(`xcopy "${_relFrom}" "${_relTo}" /S/Q/Y`);
                }
            }

            if (isSomeArray(from.files)) {
                if (!isSomeArray(to.files)) {
                    changes.push(`xcopy "${_relFrom}\\*.*" "${_relTo}\\" /Q/Y`);
                } else {
                    for (let fileFrom of from.files) {
                        const fileTo = to.files.find(d => d.name.toLowerCase() == fileFrom.name.toLowerCase());

                        if (fileTo) {
                            if (fileFrom.hash != fileTo.hash) {
                                changes.push(`xcopy "${_relFrom}\\${fileFrom.name}" "${relTo}${to.name}\\" /Q/Y`);

                                console.log(`${_relTo} contains ${fileFrom.name}, but it differs\n\tfrom: ${fileFrom.hash}, to: ${fileTo.hash}`);
                            }
                        } else {
                            changes.push(`xcopy "${_relFrom}\\${fileFrom.name}" "${relTo}${to.name}\\" /Q/Y`);
                            console.log(`${_relTo} misses ${fileFrom.name}`);
                        }
                    }
                }
            }
        }

        checkDir(jsonFrom, jsonTo, '.', relTo);

        return changes;
    }
}

exports.FolderNavigator = FolderNavigator;
exports.FolderUtil = FolderUtil;
