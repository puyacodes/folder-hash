'use strict';

var base = require('@locustjs/base');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

const FolderNavigationEvent = {
    onFolderNavigating: 0,
    onSubFolderNavigating: 1,
    onFileNavigating: 2,
    onFolderNavigated: 3,
    onFolderIgnored: 4,
    onFileIgnored: 5
};
class FolderNavigator {
    constructor(config) {
        this.config = Object.assign({
            excludeDirs: '',
            excludeFiles: '',
            includeDirs: '',
            includeFiles: '',
            sort: true
        }, config);

        if (!base.isString(this.config.excludeDirs)) {
            this.config.excludeDirs = [];
        } else {
            this.config.excludeDirs = this.config.excludeDirs.split(",").filter(base.isSomeString);
        }

        if (base.isSomeString(this.config.includeDirs) && this.config.excludeDirs.length) {
            this.config.includeDirs.split(",").forEach(dir => {
                const index = this.config.excludeDirs.findIndex(x => x.toLowerCase() == dir.toLowerCase());
                if (index >= 0) {
                    this.config.excludeDirs.splice(index, 1);
                }
            });
        }

        if (!base.isString(this.config.excludeFiles)) {
            this.config.excludeFiles = [];
        } else {
            this.config.excludeFiles = this.config.excludeFiles.split(",").filter(base.isSomeString);
        }

        if (!base.isString(this.config.includeFiles)) {
            this.config.includeFiles = [];
        } else {
            this.config.includeFiles = this.config.includeFiles.split(",").filter(base.isSomeString);
        }
    }
    _isExcludedFile(file) {
        let result = false;
        const ext = path.parse(file).ext;

        if (this.config.excludeFiles.length) {
            if (
                this.config.excludeFiles.contains(file) ||
                (
                    ext && this.config.excludeFiles.contains(`*${ext}`)
                )
            ) {
                if (this.config.includeFiles.length) {
                    result = !this.config.includeFiles.contains(file);
                } else {
                    result = true;
                }
            }
        }

        return result;
    }
    async _navigate(node, dir, callback, level = 0) {
        if (fs.existsSync(dir)) {
            const stat = fs.statSync(dir);

            if (stat && stat.isDirectory()) {
                node.name = level == 0 ? "" : path.parse(dir).base;

                let r = await callback({ name: node.name, fullPath: dir, dir: true, level, state: FolderNavigationEvent.onFolderNavigating, node });

                if (base.isObject(r)) {
                    for (let key of Object.keys(r)) {
                        node[key] = r[key];
                    }
                }

                let list = fs.readdirSync(dir);

                if (this.config.sort) {
                    list.sort();
                }

                for (let i = 0; i < list.length; i++) {
                    const file = list[i];

                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);

                    if (stat && stat.isDirectory()) {
                        if (this.config.excludeDirs.contains(file)) {
                            await callback({ name: file, fullPath, dir: true, stat, level, state: FolderNavigationEvent.onFolderIgnored, node });
                        } else {
                            const r = await callback({ name: file, fullPath, dir: true, stat, level, state: FolderNavigationEvent.onSubFolderNavigating, node });

                            if (r === undefined || (base.isBool(r) && r)) {
                                if (!node.dirs) {
                                    node.dirs = [];
                                }

                                const subdir = {};

                                await this._navigate(subdir, fullPath, callback, level + 1);

                                node.dirs.push(subdir);
                            }
                        }
                    } else {
                        if (this._isExcludedFile(file)) {
                            await callback({ name: file, fullPath, dir: false, stat, level, state: FolderNavigationEvent.onFileIgnored, node });
                        } else {
                            const r = await callback({ name: file, fullPath, dir: false, stat, level, state: FolderNavigationEvent.onFileNavigating, node });

                            if (r === undefined || (base.isBool(r) && r)) {
                                if (!node.files) {
                                    node.files = [];
                                }

                                node.files.push(file);
                            } else if (r !== undefined && r && !base.isBool(r)) {
                                if (!node.files) {
                                    node.files = [];
                                }

                                node.files.push(r);
                            }
                        }
                    }
                }

                r = await callback({ name: node.name, dir: true, level, state: FolderNavigationEvent.onFolderNavigated, node });

                if (base.isObject(r)) {
                    for (let key of Object.keys(r)) {
                        node[key] = r[key];
                    }
                }
            }
        }
    }
    async navigate(dir, callback) {
        const result = {};

        if (this.config.debugMode) {
            console.log(this.config);
        }

        if (!path.isAbsolute(dir)) {
            dir = path.join(process.cwd(), dir);
        }

        if (!base.isFunction(callback)) {
            callback = () => { };
        }

        await this._navigate(result, dir, callback);

        return result;
    }

}

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

const FolderChangeType = {
    MissingSubDir: 'missing-subdir',
    MissingFiles: 'missing-files',
    FileMismatch: 'file-mismatch',
    MissingFile: 'missing-file'
};

async function copyDirectory(source, destination) {
    await fs.promises.mkdir(destination, { recursive: true }); // Create the destination folder if it doesn't exist

    const items = await fs.promises.readdir(source, { withFileTypes: true }); // Read the source directory

    for (const item of items) {
        const sourcePath = path.join(source, item.name);
        const destinationPath = path.join(destination, item.name);

        if (item.isDirectory()) {
            // If it's a folder, recursively copy its contents
            await copyDirectory(sourcePath, destinationPath);
        } else {
            // If it's a file, copy it
            await fs.promises.copyFile(sourcePath, destinationPath);
        }
    }
}

async function copyFiles(source, destination) {
    await fs.promises.mkdir(destination, { recursive: true }); // Create the destination folder if it doesn't exist

    const files = await fs.promises.readdir(source); // Read all items in the source directory

    for (const file of files) {
        const sourcePath = path.join(source, file);
        const destinationPath = path.join(destination, file);
        const stats = await fs.promises.lstat(sourcePath);

        if (stats.isFile()) {
            // If it's a file, copy it
            await fs.promises.copyFile(sourcePath, destinationPath);
        }
    }
}

function copyFileWithDirs(source, destination) {
    const dir = path.dirname(destination);

    fs.mkdirSync(dir, { recursive: true }); // Create directory structure
    fs.copyFileSync(source, destination);  // Copy the file
}

class FolderUtil {
    static excludeDirs = 'node_modules,.git,tests,packages,wwwroot,__tests__,coverage,.vscode,.idea,build,publish,.vs';
    static excludeFiles = 'thumbs.db,package.json,packages.config,.env,.gitignore,.ds_store,*.log,*.test.js,*.spec.js,*.bak,*.tmp,sync.bat,sync.sh';

    static _getConfig(options) {
        const config = {
            excludeDirs: FolderUtil.excludeDirs,
            excludeFiles: FolderUtil.excludeFiles
        };

        if (base.isObject(options)) {
            if (base.isSomeString(options.excludeDirs)) {
                if (options.excludeDirs.startsWith(",")) {
                    config.excludeDirs += options.excludeDirs;
                } else {
                    config.excludeDirs = options.excludeDirs;
                }
            }
            if (base.isSomeString(options.excludeFiles)) {
                if (options.excludeFiles.startsWith(",")) {
                    config.excludeFiles += options.excludeFiles;
                } else {
                    config.excludeFiles = options.excludeFiles;
                }
            }
            if (base.isSomeString(options.includeDirs)) {
                config.includeDirs = options.includeDirs;
            }
            if (base.isSomeString(options.includeFiles)) {
                config.includeFiles = options.includeFiles;
            }
        } else {
            options = {};
        }

        config.sort = options.sort;
        config.debugMode = options.debugMode;

        return config;
    }
    static async getHash(dir, onProgress, options) {
        const fn = new FolderNavigator(FolderUtil._getConfig(options));

        if (!base.isFunction(onProgress)) {
            onProgress = () => { };
        }

        const callback = async (args) => {
            onProgress(args);

            const { name, fullPath, dir, state, node } = args;

            if (!dir) {
                return { name, hash: await getFileMd5(fullPath) }
            }

            if (state == FolderNavigationEvent.onFolderNavigated) {
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
    static async diff(fromDir, toDir, fromRel, toRel, options) {
        let jsonFrom, jsonTo;

        if (!base.isString(fromRel)) {
            fromRel = ".";
        }

        if (base.isString(fromDir)) {
            if (fs.existsSync(fromDir)) {
                const stat = fs.statSync(fromDir);

                if (!stat.isDirectory()) {
                    try {
                        jsonFrom = JSON.parse(fs.readFileSync(fromDir, "utf-8"));
                    } catch (e) {
                        throw `Reading 'from' file failed.\n${e}`
                    }
                } else {
                    jsonFrom = await FolderUtil.getHash(fromDir, null, options);
                }
            } else {
                throw `'from' not found`
            }
        } else if (base.isObject(fromDir)) {
            jsonFrom = fromDir;
        } else {
            throw `Invalid 'from'`
        }

        if (base.isString(toDir)) {
            if (fs.existsSync(toDir)) {
                const stat = fs.statSync(toDir);

                if (!stat.isDirectory()) {
                    try {
                        jsonTo = JSON.parse(fs.readFileSync(toDir, "utf-8"));
                    } catch (e) {
                        throw `Reading 'to' file failed.\n${e}`
                    }

                    toRel = !base.isSomeString(toRel) ? path.parse(toDir).dir : toRel;
                } else {
                    jsonTo = await FolderUtil.getHash(toDir, null, options);
                    toRel = !base.isSomeString(toRel) ? path.parse(toDir).dir : toRel;
                }
            } else {
                throw `'to' not found`
            }
        } else if (base.isObject(toDir)) {
            jsonTo = toDir;

            if (!base.isSomeString(toRel)) {
                throw `target path required`
            }
        } else {
            throw `Invalid 'to'`
        }

        let changes = [];

        if (!base.isFunction(options.onChange)) {
            options.onChange = () => { };
        }

        function checkDir(from, to, relFrom, relTo) {
            if (from.hash != to.hash) { // the two folders match. no need to check them
                const _relFrom = relFrom + (from.name ? "/" + from.name : "");
                const _relTo = relTo + (to.name ? "/" + to.name : "");

                if (base.isSomeArray(from.dirs)) {
                    const toSubDirs = base.isSomeArray(to.dirs) ? to.dirs : [];

                    if (base.isSomeArray(to.dirs)) {
                        for (let subdirFrom of from.dirs) {
                            const subdirTo = toSubDirs.find(d => d.name.toLowerCase() == subdirFrom.name.toLowerCase());

                            if (subdirTo) {
                                checkDir(subdirFrom, subdirTo, _relFrom, _relTo);
                            } else {
                                const change = { from: `${_relFrom}/${subdirFrom.name}`, to: `${_relTo}/${subdirFrom.name}`, dir: true };

                                options.onChange({ path: change.to, name: subdirFrom.name, type: FolderChangeType.MissingSubDir });

                                changes.push(change);
                            }
                        }
                    }
                }

                if (base.isSomeArray(from.files)) {
                    if (!base.isSomeArray(to.files)) {
                        const change = { from: `${_relFrom}`, to: `${_relTo}/`, all: true };

                        options.onChange({ path: change.to, name: from.name, type: FolderChangeType.MissingFiles });

                        changes.push(change);
                    } else {
                        for (let fileFrom of from.files) {
                            const fileTo = to.files.find(d => d.name.toLowerCase() == fileFrom.name.toLowerCase());

                            if (fileTo) {
                                if (fileFrom.hash != fileTo.hash) {
                                    const change = { from: `${_relFrom}/${fileFrom.name}`, to: `${_relTo}/${fileFrom.name}` };

                                    options.onChange({ path: change.to, name: fileFrom.name, type: FolderChangeType.FileMismatch });

                                    changes.push(change);
                                }
                            } else {
                                const change = { from: `${_relFrom}/${fileFrom.name}`, to: `${_relTo}/${fileFrom.name}` };

                                options.onChange({ path: change.to, name: fileFrom.name, type: FolderChangeType.MissingFile });

                                changes.push(change);
                            }
                        }
                    }
                }
            }
        }

        checkDir(jsonFrom, jsonTo, fromRel, toRel);

        return changes;
    }
    static async apply(fromDir, toDir, relFrom, relTo, options) {
        const changes = await FolderUtil.diff(fromDir, toDir, relFrom, relTo, options);

        for (let change of changes) {
            if (change.dir) {
                await copyDirectory(change.from, change.to);
            } else if (change.all) {
                await copyFiles(change.from, change.to);
            } else {
                copyFileWithDirs(change.from, change.to);
            }
        }

        return changes;
    }
}

function containsAll(str, ...args) {
    let result = false;

    if (base.isSomeString(str)) {
        if (args.length) {
            result = true;

            const _str = str.toLowerCase();

            for (let arg of args) {
                const value = base.isNullOrUndefined(arg) ? "" : arg.toString().toLowerCase();

                if (!_str.includes(value)) {
                    result = false;
                    break;
                }
            }
        } else {
            result = true;
        }
    }

    return result;
}

function containsAny(str, ...args) {
    let result = true;

    if (base.isSomeString(str) && args.length) {
        result = false;

        const _str = str.toLowerCase();

        for (let arg of args) {
            const value = base.isNullOrUndefined(arg) ? "" : arg.toString().toLowerCase();

            if (_str.includes(value)) {
                result = true;
                break;
            }
        }
    }

    return result;
}

// --------------------------------------------
//              String extensions
// --------------------------------------------

if (String.prototype.contains === undefined) {
    String.prototype.contains = function (...args) {
        return containsAll(this, ...args);
    };
}

if (String.prototype.containsAll === undefined) {
    String.prototype.containsAll = function (...args) {
        return containsAll(this, ...args);
    };
}

if (String.prototype.containsAny === undefined) {
    String.prototype.containsAny = function (...args) {
        return containsAny(this, ...args);
    };
}

// --------------------------------------------
//              Array extensions
// --------------------------------------------

if (Array.prototype.contains === undefined) {
    Array.prototype.contains = function (arg) {
        let result = false;

        for (let item of this) {
            if ((item || "").toString().contains(arg)) {
                result = true;
                break;
            }
        }

        return result;
    };
}

function equals(str1, str2, ignoreCase = true) {
    let result = false;

    if (base.isString(str1) && base.isString(str2)) {
        result = ignoreCase ? str1.toLowerCase() == str2.toLowerCase(): str1 == str2;
    } else {
        result = base.isNullOrEmpty(str1) && base.isNullOrEmpty(str2);
    }

    return result;
}

if (String.prototype.equals === undefined) {
    String.prototype.equals = function (...args) {
        return equals(this, ...args);
    };
}

exports.FolderChangeType = FolderChangeType;
exports.FolderNavigationEvent = FolderNavigationEvent;
exports.FolderNavigator = FolderNavigator;
exports.FolderUtil = FolderUtil;
