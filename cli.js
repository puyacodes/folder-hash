const { isSomeString } = require("@locustjs/base");
const { FolderUtil, FolderChangeType, FolderNavigationEvent } = require("./dist");
const { version } = require("./package.json");
const fs = require("fs");
const path = require("path");
const { Exception } = require("@locustjs/exception");
const chalk = require("chalk");
const os = require('os');
const workingDir = process.cwd();

function showHelp(examples) {
    console.log(`
Folder Hash v${version}
`);
    if (examples) {
        console.log(`
Examples:
${examples == "hash" || examples == "all" ? `
    create hash
        1. create hash for current directory
            fh
        2. create hash for /publish folder in current directory
            fh hash -d publish
        2. create hash for /publish folder as output.json
            fh hash -d publish -o output.json
        3. create hash for /publish folder in current directory, do not sort file/folders
            fh hash -d publish -ns
        4. create hash for /publish folder in current directory, quiet mode.
            fh hash -d publish -q
    `: ``}
${examples == "diff" || examples == "all" ? `
    get diff on two folders
            1. compare ./dev to ./prod directories, report changes

                fh diff -f ./dev -t ./prod
                
            2. compare dev.json to prod.json hash files, report changes

                fh diff -f dev.json -t prod.json

            3. compare ./dev to prod.json, report changes

                fh diff -f ./dev -t prod.json

            4. compare ./dev to ./prod directories, generate cmd batch file

                fh diff -f ./dev -t ./prod -k cmd

            5. compare ./dev to ./prod directories, generate bash file named ch20250512.sh

                fh diff -f ./dev -t ./prod -k bash -o ch20250512.sh

            6. compare ./dev to prod.json, generate cmd batch file named ch20250512.bat

                fh diff -f ./dev -t prod.json -rt ./publish -k cmd -o ch20250512.bat
    `: ``}
${examples == "apply" || examples == "all" ? `
    apply changes
            1. compare ./dev to ./prod directories, apply changes from './dev' into './prod'.

                fh apply -f ./dev -t ./prod

            2. compare ./dev to prod.json, copy into -rt

                fh apply -f ./dev -t ./prod -rt ./publish
    `: ``}
`);
    } else {
        console.log(`
  Usage: fh [cmd] [args] [options]

  cmd
        hash    create hash for the given directory (default commad)
        diff    show differences of two folder hash files or create a batch file
                based on differences between the two specified directories
            options
                -f or --from            from dir
                -t or --to              to dir
                -rf or --relative-from  change 'from' paths relative to value of -rf 
                -rt or --relative-to    change 'to' paths relative to value of -rt 
                -k or --kind            kind of diff: 'cmd', 'bash', 'report'
            
            notes:
                it ignores extra dir/files in 'to' dir that are not found in 'from' dir
                if -rf is not specified, it uses current dir "./"
                if -rt is not specified, it uses 'to' dir. if 'to' dir
                    is not distinguishable, it uses current dir "./"
        apply   copy detected changes based on 'from' dir to 'to' dir into '-rt' dir

            notes:  this command is best used when -rt is specified.
                    -rf and -rt work the same as in 'diff' command.
                    it creates directory structure by default.
                    it overwrites existing files by default.
                    it does not remove extra dir/files in 'to' dir that are not found in 'from' dir

  options:
    -? or --help            help
    -e or --examples        show examples
    -v or --version         show app version
    - q or --quiet          quiet mode. do not produce console messages.
    -dbm or --debug-mode    debug mode
    -dp or --deep           deep debug
    -ed or --exclude-dirs   excluded directories (ignore specified directories)
    -ef or --exclude-files  excluded files (ignore specified files)
    -id or --include-dirs   included directories (do not ignore specified directories)
    -if or --include-files  included files (do not ignore specified files)
    -ns or --no-sort        do not sort files/directories by name
`);
    }
}

async function FolderHashCLI(args) {
    function getArg(arg, altArg, defaultValue) {
        let index = args.indexOf(arg);

        if (index < 0 && altArg) {
            index = args.indexOf(altArg);
        }

        let result = index >= 0 ? args[index + 1] : undefined;

        if (!isSomeString(result)) {
            result = defaultValue;
        }

        return result;
    }
    function initPath(argName, altArgName, useDefaultPath = true) {
        let result = getArg(argName, altArgName);

        if (!isSomeString(result) && useDefaultPath) {
            result = workingDir;
        }

        if (isSomeString(result)) {
            if (!path.isAbsolute(result)) {
                result = path.join(workingDir, result);
            }
        }

        return result;
    }
    function initOutput(defaultName) {
        let output = getArg("-o", "--output");

        if (!isSomeString(output)) {
            output = defaultName;
        }

        if (!path.isAbsolute(output)) {
            output = path.join(workingDir, output);
        }

        return output;
    }

    const debugMode = args.includes("-dbm") || args.includes("--debug-mode");
    const quiet = args.includes("-q") || args.includes("--quiet");
    const deep = args.includes("-dp") || args.includes("--deep");

    try {
        if (args.includes("--help") || args.includes("-?") || args.includes("/?")) {
            showHelp(getArg("-e", "--examples", "all"));

            return;
        }

        const options = { debugMode }
        let command = args[0];

        if (!command || command.startsWith("-")) {
            command = "hash";
        }

        let dir, changes, output, from, to, result, relFrom, relTo, kind;

        options.excludeDirs = getArg("-ed", "--exclude-dirs");
        options.excludeFiles = getArg("-ef", "--exclude-files");
        options.includeDirs = getArg("-id", "--include-dirs");
        options.includeFiles = getArg("-if", "--include-files");
        options.sort = !(args.includes("-ns") || args.includes("--no-sort"));

        if (debugMode) {
            console.log({ options })
        }

        switch (command) {
            case 'hash':
                dir = initPath("-d", "--dir");
                output = initOutput(path.parse(dir).base + ".json");

                result = await FolderUtil.getHash(dir, ({ fullPath, dir, state }) => {
                    if (!quiet) {
                        if (dir) {
                            if (state == FolderNavigationEvent.onFolderNavigating) {
                                console.log(fullPath)
                            } else if (state == FolderNavigationEvent.onFolderIgnored && debugMode) {
                                console.log(chalk.yellow(`folder ignored ${fullPath}`))
                            }
                        } else {
                            if (deep) {
                                if (state != FolderNavigationEvent.onFileIgnored) {
                                    console.log(fullPath)
                                } else if (debugMode) {
                                    console.log(chalk.yellow(`file ignored ${fullPath}`))
                                }
                            }
                        }
                    }
                }, options);

                fs.writeFileSync(output, JSON.stringify(result, null, 4));

                console.log("\n" + result.hash);

                break;
            case 'diff':
                from = initPath("-f", "--from");
                to = initPath("-t", "--to");
                relFrom = initPath("-rf", "--relative-from", false);
                relTo = initPath("-rt", "--relative-to", false);
                kind = getArg("-k", "--kind");

                if (debugMode) {
                    console.log({
                        from,
                        to,
                        relFrom,
                        relTo,
                        kind
                    })
                }

                if (!isSomeString(kind)) {
                    kind = "report";
                }

                if (!["cmd", "bash", "json", "report"].contains(kind)) {
                    throw `invalid output kind`;
                }

                if (kind == "report") {
                    options.onChange = (change) => {
                        let _path = os.platform() === 'win32' ? change.path.replace(/\//g, "\\") : change.path;

                        if (_path.indexOf(workingDir) >= 0) {
                            _path = "." + _path.substr(workingDir.length)
                        }

                        switch (change.type) {
                            case FolderChangeType.MissingSubDir:
                                console.log(chalk.magenta(`Missing sub-ir: ${_path}`));
                                break;
                            case FolderChangeType.MissingFiles:
                                console.log(chalk.cyan(`Empty dir: ${_path}`));
                                break;
                            case FolderChangeType.FileMismatch:
                                console.log(chalk.yellow(`File mismatch: ${_path}`));
                                break;
                            case FolderChangeType.MissingFile:
                                console.log(chalk.red(`Missing file: ${_path}`));
                                break;
                        }

                    }
                }

                changes = await FolderUtil.diff(from, to, relFrom, relTo, options);

                if (debugMode) {
                    console.log({ changes })
                }

                switch (kind) {
                    case "cmd":
                        output = initOutput("sync.bat");
                        result = changes.map(x => ({
                            ...x,
                            from: x.from.replace(/\//g, "\\"),
                            to: x.to.replace(/\//g, "\\"),
                        }))
                            .map(x => x.dir ? `xcopy "${x.from}${x.all ? "\\*.*" : ""}" "${x.to}" /S/Q/Y/H/I/R`
                                : `xcopy "${path.parse(x.from).dir}" "${path.parse(x.to).dir}" /T/Q/Y/I
xcopy "${x.from}${x.all ? "\\*.*" : ""}" "${path.parse(x.to).dir}" /S/Q/Y/H/I/R`)
                            .join("\n");
                        result = `@echo off

${result}

${changes.length ? `echo ${changes.length} file(s)/dir(s) copied.` : `echo no changes found.`}
`;
                        break;
                    case "bash":
                        output = initOutput("sync.sh");
                        result = changes.map(x => `cp "${x.from}${x.all ? "/*" : ""}" "${x.to}" ${x.dir ? "-r" : ""} -f`)
                            .join("\n");
                        result = `
${result}

${changes.length ? `echo "${changes.length} file(s)/dir(s) copied."` : `echo "no changes found."`}
                            `;
                        break;
                    case "json":
                        output = initOutput("sync.json");
                        result = JSON.stringify(changes, null, 4);
                        break;
                    case "report":
                        output = "";
                        break;
                }

                if (output) {
                    fs.writeFileSync(output, result);
                }

                if (!quiet && !changes.length) {
                    console.log(`no changes found.`)
                }

                break;
            case 'apply':
                from = initPath("-f", "--from");
                to = initPath("-t", "--to");
                relFrom = initPath("-rf", "--relative-from", false);
                relTo = initPath("-rt", "--relative-to", false);

                changes = await FolderUtil.apply(from, to, relFrom, relTo, options);

                if (!quiet) {
                    if (changes.length) {
                        console.log(`${changes.length} file(s)/dir(s) copied.`)
                    } else {
                        console.log(`no changes found.`)
                    }
                }

                break;
            default:
                console.log(`unknown command ${command}`);

                break;
        }
    } catch (error) {
        const ex = new Exception(error)
        console.error(`Error: ${ex.toString()}`);

        if (debugMode) {
            console.log(ex.stackTrace)
        }
    }
}

FolderHashCLI(process.argv.slice(2))
