import { isSomeString, isString, isBool, isFunction, isObject } from "@locustjs/base";
import fs from "fs";
import path from "path";

const FolderNavigationEvent = {
    onFolderNavigating: 0,
    onSubFolderNavigating: 1,
    onFileNavigating: 2,
    onFolderNavigated: 3,
    onFolderIgnored: 4,
    onFileIgnored: 5
}
class FolderNavigator {
    constructor(config) {
        this.config = Object.assign({
            excludeDirs: '',
            excludeFiles: '',
            includeDirs: '',
            includeFiles: '',
            sort: true
        }, config);

        if (!isString(this.config.excludeDirs)) {
            this.config.excludeDirs = []
        } else {
            this.config.excludeDirs = this.config.excludeDirs.split(",").filter(isSomeString);
        }

        if (!isString(this.config.includeDirs)) {
            this.config.includeDirs = []
        } else {
            this.config.includeDirs = this.config.includeDirs.split(",").filter(isSomeString);
        }

        if (!isString(this.config.excludeFiles)) {
            this.config.excludeFiles = [];
        } else {
            this.config.excludeFiles = this.config.excludeFiles.split(",").filter(isSomeString);
        }

        if (!isString(this.config.includeFiles)) {
            this.config.includeFiles = []
        } else {
            this.config.includeFiles = this.config.includeFiles.split(",").filter(isSomeString);
        }
    }
    _isExcludedDir(dir, relDir) {
        let result = false;

        if (this.config.excludeDirs.length) {
            if (this.config.excludeDirs.contains(dir)) {
                if (this.config.includeDirs.length) {
                    const _relDir = relDir.replace(/\\/g, "/");
                    
                    result = !this.config.includeDirs.contains(dir) &&
                             !this.config.includeDirs.contains(relDir) &&
                             !this.config.includeDirs.contains(_relDir)
                } else {
                    result = true;
                }
            }
        }

        return result;
    }
    _isExcludedFile(file) {
        let result = false;
        const ext = path.parse(file).ext

        if (this.config.excludeFiles.length) {
            if (
                this.config.excludeFiles.contains(file) ||
                (
                    ext && this.config.excludeFiles.contains(`*${ext}`)
                )
            ) {
                if (this.config.includeFiles.length) {
                    result = !this.config.includeFiles.contains(file)
                } else {
                    result = true;
                }
            }
        }

        return result;
    }
    async _navigate(node, dir, callback, level, relPath) {
        if (fs.existsSync(dir)) {
            if (fs.statSync(dir).isDirectory()) {
                node.name = level == 0 ? "" : path.parse(dir).base;
                node.path = level == 0 ? "/" : relPath + "/" + node.name;

                let r = await callback({ name: node.name, fullPath: dir, dir: true, level, state: FolderNavigationEvent.onFolderNavigating, node });

                if (isObject(r)) {
                    for (let key of Object.keys(r)) {
                        node[key] = r[key];
                    }
                }

                let list = fs.readdirSync(dir);

                if (this.config.sort) {
                    list.sort();
                }

                for (let i = 0; i < list.length; i++) {
                    const item = list[i];

                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);

                    if (stat && stat.isDirectory()) {
                        if (this._isExcludedDir(item, node.path)) {
                            await callback({ name: item, fullPath, dir: true, stat, level, state: FolderNavigationEvent.onFolderIgnored, node });
                        } else {
                            const r = await callback({ name: item, fullPath, dir: true, stat, level, state: FolderNavigationEvent.onSubFolderNavigating, node });

                            if (r === undefined || (isBool(r) && r)) {
                                if (!node.dirs) {
                                    node.dirs = []
                                }

                                const subdir = {}

                                await this._navigate(subdir, fullPath, callback, level + 1, node.path);

                                node.dirs.push(subdir);
                            }
                        }
                    } else {
                        if (this._isExcludedFile(item)) {
                            await callback({ name: item, fullPath, dir: false, stat, level, state: FolderNavigationEvent.onFileIgnored, node });
                        } else {
                            const r = await callback({ name: item, fullPath, dir: false, stat, level, state: FolderNavigationEvent.onFileNavigating, node });

                            if (r === undefined || (isBool(r) && r)) {
                                if (!node.files) {
                                    node.files = []
                                }

                                node.files.push(item);
                            } else if (r !== undefined && r && !isBool(r)) {
                                if (!node.files) {
                                    node.files = []
                                }

                                node.files.push(r);
                            }
                        }
                    }
                }

                r = await callback({ name: node.name, dir: true, level, state: FolderNavigationEvent.onFolderNavigated, node });

                if (isObject(r)) {
                    for (let key of Object.keys(r)) {
                        node[key] = r[key];
                    }
                }
            }
        }
    }
    async navigate(dir, callback) {
        const result = {}

        if (this.config.debugMode) {
            console.log(this.config)
        }

        if (!path.isAbsolute(dir)) {
            dir = path.join(process.cwd(), dir)
        }

        if (!isFunction(callback)) {
            callback = () => { }
        }

        await this._navigate(result, dir, callback, 0, "");

        return result;
    }

}

export { FolderNavigator, FolderNavigationEvent };