import { isSomeString, isString, isFunction, isObject, isSomeArray, isNumeric } from "@locustjs/base";
import fs from "fs";
import path from "path";
import getFileMd5 from "./getFileMD5";
import getMd5 from "./getMd5";
import { FolderNavigator, FolderNavigationEvent } from "./FolderNavigator";
import archiver from "archiver";
import crypto from 'crypto';

const FolderChangeType = {
    MissingSubDir: 'missing-subdir',
    MissingFiles: 'missing-files',
    FileMismatch: 'file-mismatch',
    MissingFile: 'missing-file'
}

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

async function zipFolder(sourceFolder, zipFilePath, compressionLevel) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: compressionLevel } });

        output.on('close', () => {
            resolve({ length: archive.pointer() });
        });

        archive.on('error', err => reject(err));

        archive.pipe(output);
        archive.directory(sourceFolder, false);
        archive.finalize();
    });
}

class FolderUtil {
    static excludeDirs = 'node_modules,.git,tests,packages,wwwroot,__tests__,coverage,.vscode,.idea,build,publish,.vs';
    static excludeFiles = 'thumbs.db,package.json,packages.config,.env,.gitignore,.ds_store,*.log,*.test.js,*.spec.js,*.bak,*.tmp,sync.bat,sync.sh';

    static _getConfig(options) {
        const config = {
            excludeDirs: FolderUtil.excludeDirs,
            excludeFiles: FolderUtil.excludeFiles
        }

        if (isObject(options)) {
            if (isSomeString(options.excludeDirs)) {
                if (options.excludeDirs.startsWith(",")) {
                    config.excludeDirs += options.excludeDirs
                } else {
                    config.excludeDirs = options.excludeDirs
                }
            }
            if (isSomeString(options.excludeFiles)) {
                if (options.excludeFiles.startsWith(",")) {
                    config.excludeFiles += options.excludeFiles
                } else {
                    config.excludeFiles = options.excludeFiles
                }
            }
            if (isSomeString(options.includeDirs)) {
                config.includeDirs = options.includeDirs
            }
            if (isSomeString(options.includeFiles)) {
                config.includeFiles = options.includeFiles
            }
        } else {
            options = {}
        }

        config.sort = options.sort;
        config.debugMode = options.debugMode;

        return config;
    }
    static async getHash(dir, onProgress, options) {
        const fn = new FolderNavigator(FolderUtil._getConfig(options));

        if (!isFunction(onProgress)) {
            onProgress = () => { }
        }

        const callback = async (args) => {
            onProgress(args);

            const { name, fullPath, dir, state, node } = args;

            if (!dir) {
                return { name, hash: await getFileMd5(fullPath) }
            }

            if (state == FolderNavigationEvent.onFolderNavigated) {
                let hashes = []

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
        }

        const result = await fn.navigate(dir, callback);

        return result;
    }
    static async diff(fromDir, toDir, fromRel, toRel, options) {
        let jsonFrom, jsonTo;

        if (!isObject(options)) {
            options = {}
        }

        if (!isString(fromRel)) {
            fromRel = ".";
        }

        if (isString(fromDir)) {
            if (fs.existsSync(fromDir)) {
                const stat = fs.statSync(fromDir);

                if (!stat.isDirectory()) {
                    try {
                        jsonFrom = JSON.parse(fs.readFileSync(fromDir, "utf-8"));
                    } catch (e) {
                        throw `Reading 'from' file failed.\n${e}`
                    }
                } else {
                    if (isFunction(options.onFromProgress)) {
                        console.log(`navigating 'from' dir: ${toDir}`);
                    }

                    jsonFrom = await FolderUtil.getHash(fromDir, options.onFromProgress, options);
                }
            } else {
                throw `'from' not found`
            }
        } else if (isObject(fromDir)) {
            jsonFrom = fromDir;
        } else {
            throw `Invalid 'from'`
        }

        if (isString(toDir)) {
            if (fs.existsSync(toDir)) {
                const stat = fs.statSync(toDir);

                if (!stat.isDirectory()) {
                    try {
                        jsonTo = JSON.parse(fs.readFileSync(toDir, "utf-8"));
                    } catch (e) {
                        throw `Reading 'to' file failed.\n${e}`
                    }

                    toRel = !isSomeString(toRel) ? path.parse(toDir).dir : toRel;
                } else {
                    if (isFunction(options.onToProgress)) {
                        console.log(`\nnavigating 'to' dir: ${toDir}`);
                    }

                    jsonTo = await FolderUtil.getHash(toDir, options.onToProgress, options);
                    toRel = !isSomeString(toRel) ? path.parse(toDir).dir : toRel;
                }
            } else {
                throw `'to' not found`
            }
        } else if (isObject(toDir)) {
            jsonTo = toDir;

            if (!isSomeString(toRel)) {
                throw `target path required`
            }
        } else {
            throw `Invalid 'to'`
        }

        let changes = [];

        if (!isFunction(options.onChange)) {
            options.onChange = () => { }
        }

        function checkDir(from, to, relFrom, relTo) {
            if (from.hash != to.hash) { // the two folders match. no need to check them
                const _relFrom = relFrom + (from.name ? "/" + from.name : "");
                const _relTo = relTo + (to.name ? "/" + to.name : "");

                if (isSomeArray(from.dirs)) {
                    const toSubDirs = isSomeArray(to.dirs) ? to.dirs : [];

                    if (isSomeArray(to.dirs)) {
                        for (let subdirFrom of from.dirs) {
                            const subdirTo = toSubDirs.find(d => d.name.toLowerCase() == subdirFrom.name.toLowerCase());

                            if (subdirTo) {
                                checkDir(subdirFrom, subdirTo, _relFrom, _relTo);
                            } else {
                                const change = { from: `${_relFrom}/${subdirFrom.name}`, to: `${_relTo}/${subdirFrom.name}`, dir: true }

                                options.onChange({ path: change.to, name: subdirFrom.name, type: FolderChangeType.MissingSubDir });

                                changes.push(change);
                            }
                        }
                    } else {
                        for (let subdirFrom of from.dirs) {
                            const change = { from: `${_relFrom}/${subdirFrom.name}`, to: `${_relTo}/${subdirFrom.name}`, dir: true }

                            options.onChange({ path: change.to, name: subdirFrom.name, type: FolderChangeType.MissingSubDir });

                            changes.push(change);
                        }
                    }
                }

                if (isSomeArray(from.files)) {
                    if (!isSomeArray(to.files)) {
                        const change = { from: `${_relFrom}`, to: `${_relTo}/`, all: true }

                        options.onChange({ path: change.to, name: from.name, type: FolderChangeType.MissingFiles });

                        changes.push(change)
                    } else {
                        for (let fileFrom of from.files) {
                            const fileTo = to.files.find(d => d.name.toLowerCase() == fileFrom.name.toLowerCase());

                            if (fileTo) {
                                if (fileFrom.hash != fileTo.hash) {
                                    const change = { from: `${_relFrom}/${fileFrom.name}`, to: `${_relTo}/${fileFrom.name}` }

                                    options.onChange({ path: change.to, name: fileFrom.name, type: FolderChangeType.FileMismatch });

                                    changes.push(change);
                                }
                            } else {
                                const change = { from: `${_relFrom}/${fileFrom.name}`, to: `${_relTo}/${fileFrom.name}` }

                                options.onChange({ path: change.to, name: fileFrom.name, type: FolderChangeType.MissingFile });

                                changes.push(change)
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
        let _relTo;

        if (!isObject(options)) {
            options = {}
        }

        if (options.compress) {
            _relTo = path.join(relTo, "~" + crypto.randomUUID().substr(0, 8));
        }

        if (!isNumeric(options.compressionLevel)) {
            options.compressionLevel = 9;
        } else {
            options.compressionLevel = parseInt(options.compressionLevel);

            if (options.compressionLevel < 0) {
                throw `invalid compression level`
            } else if (options.compressionLevel > 9) {
                throw `unsupported compression level (maximum is 9)`
            }
        }

        const changes = await FolderUtil.diff(fromDir, toDir, relFrom, options.compress ? _relTo : relTo, options);

        if (options.debugMode) {
            console.log({ changes })
        }

        let count = 0;

        for (let change of changes) {
            if (options.debugMode) {
                console.log('applying ', change)
            }

            if (change.dir) {
                await copyDirectory(change.from, change.to);
            } else if (change.all) {
                await copyFiles(change.from, change.to);
            } else {
                copyFileWithDirs(change.from, change.to);
            }

            count++;
        }

        if (options.compress) {
            if (count) {
                await zipFolder(_relTo, options.output, options.compressionLevel);
            }

            fs.rmSync(_relTo, { recursive: true, force: true });
        }

        return changes;
    }
}

export { FolderUtil, FolderChangeType };