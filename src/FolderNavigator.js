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

        if (isSomeString(this.config.includeDirs) && this.config.excludeDirs.length) {
            this.config.includeDirs.split(",").forEach(dir => {
                const index = this.config.excludeDirs.findIndex(x => x.toLowerCase() == dir.toLowerCase());
                if (index >= 0) {
                    this.config.excludeDirs.splice(index, 1);
                }
            })
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
    async _navigate(node, dir, callback, level = 0) {
        if (fs.existsSync(dir)) {
            const stat = fs.statSync(dir);

            if (stat && stat.isDirectory()) {
                node.name = level == 0 ? "" : path.parse(dir).base;

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
                    const file = list[i];

                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);

                    if (stat && stat.isDirectory()) {
                        if (this.config.excludeDirs.contains(file)) {
                            await callback({ name: file, fullPath, dir: true, stat, level, state: FolderNavigationEvent.onFolderIgnored, node });
                        } else {
                            const r = await callback({ name: file, fullPath, dir: true, stat, level, state: FolderNavigationEvent.onSubFolderNavigating, node });

                            if (r === undefined || (isBool(r) && r)) {
                                if (!node.dirs) {
                                    node.dirs = []
                                }

                                const subdir = {}

                                await this._navigate(subdir, fullPath, callback, level + 1);

                                node.dirs.push(subdir);
                            }
                        }
                    } else {
                        if (this._isExcludedFile(file)) {
                            await callback({ name: file, fullPath, dir: false, stat, level, state: FolderNavigationEvent.onFileIgnored, node });
                        } else {
                            const r = await callback({ name: file, fullPath, dir: false, stat, level, state: FolderNavigationEvent.onFileNavigating, node });

                            if (r === undefined || (isBool(r) && r)) {
                                if (!node.files) {
                                    node.files = []
                                }

                                node.files.push(file);
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

        await this._navigate(result, dir, callback);

        return result;
    }

}

export { FolderNavigator, FolderNavigationEvent };