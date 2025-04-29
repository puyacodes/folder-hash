const { isSomeString } = require("@locustjs/base");
const { FolderUtil } = require("./dist");
const { version } = require("./package.json");
const fs = require("fs");
const path = require("path");

function showHelp() {
    console.log(`
fh v${version}
  Usage: fh [options]

  Options:
    -?  --help            help
    -v  --version         version
    -l  --locale          locale to use for formatting the date/time. e.g. 'en' or 'fa' (default = en).
    -o  --output          output file name where the result will be saved. default is info.json.
    -t  --template        template file.
    -f  --format          format string to use for formatting the date/time. default is "YYYYMMDDHHmm".
    -i  --inline-template inline template string.

  Examples:
    ts
    ts -l en -o result.json -t template.txt -f YYYYMMDDHHmmss
    ts -l fa -o result.json -i "{ hash: '{ts}' }"
    `);
}

async function FolderHashCLI(args) {
    function getArg(arg, altArg) {
        let index = args.indexOf(arg);

        if (index < 0 && altArg) {
            index = args.indexOf(altArg);
        }

        const result = index >= 0 ? args[index + 1] : undefined;

        return result;
    }
    function initPath(argName, altArgName) {
        let result = getArg(argName, altArgName);

        if (!isSomeString(result)) {
            result = process.cwd();
        }

        if (!path.isAbsolute(result)) {
            result = path.join(process.cwd(), result);
        }

        return result;
    }
    function initOutput(defaultName) {
        output = getArg("-o", "--output");

        if (!isSomeString(output)) {
            output = defaultName;
        }

        if (!path.isAbsolute(output)) {
            output = path.join(process.cwd(), output);
        }

        return result;
    }

    try {
        if (args.includes("--help") || args.includes("-?") || args.includes("/?")) {
            showHelp();

            return;
        }

        const options = {}
        const command = args[0] || 'hash';
        let dir, output, from, to, result, dest, kind;

        options.excludeDirs = getArg("-ed", "--exclude-dirs");
        options.excludeFiles = getArg("-ef", "--exclude-files");
        options.includeDirs = getArg("-id", "--include-dirs");
        options.includeFiles = getArg("-if", "--include-files");
        options.sort = !(args.includes("-ns") || args.includes("--no-sort"));

        switch (command) {
            case 'hash':
                const quiet = args.includes("-q") || args.includes("--quiet");

                dir = initPath("-d", "--dir");
                output = initOutput(path.parse(dir).base + ".json");

                result = await FolderUtil.getHash(dir, ({ fullPath, dir, state }) => {
                    if (dir && state == 0 && !quiet) {
                        console.log(fullPath)
                    }
                }, options);

                fs.writeFileSync(output, JSON.stringify(result, null, 4));

                console.log(result.hash + "");

                break;
            case 'diff':
                from = initPath("-f", "--from");
                to = initPath("-t", "--to");
                dest = initPath("-d", "--dest");
                kind = getArg("-k", "--kind");

                if (!isSomeString(kind)) {
                    throw `Please specify kind of output`
                }

                if (!["cmd", "bash", "json", "report"].contains(kind)) {
                    throw `invalid output kind`;
                }

                if (kind == "report") {
                    options.onChange = (change) => {
                        switch (change.type) {
                            case "missing-subdir":
                                console.log(`${change.path} misses ${change.name} sub-dir.`);
                                break;
                            case "missing-files":
                                console.log(`${change.path} is empty and misses all files.`);
                                break;
                            case "file-mismatch":
                                console.log(`${change.path} contains a different ${change.name} file.`);
                                break;
                            case "missing-file":
                                console.log(`${change.path} misses ${change.name} file.`);
                                break;
                        }

                    }
                }

                result = await FolderUtil.diff(from, to, dest, options);

                switch (kind) {
                    case "cmd":
                        output = initOutput("sync.bat");
                        result = changes.map(x => ({
                            ...x,
                            from: x.from.replace(/\//g, "\\"),
                            to: x.to.replace(/\//g, "\\"),
                        }))
                            .map(x => `xcopy "${x.from}${x.all ? "\\*.*" : ""}" "${x.to}" ${x.dir ? "/S" : ""}/Q/Y`)
                            .join("\n");
                        break;
                    case "bash":
                        output = initOutput("sync.sh");
                        result = changes.map(x => `cp "${x.from}${x.all ? "/*" : ""}" "${x.to}" ${x.dir ? "-r" : ""} -f`)
                            .join("\n");
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

                break;
            case 'sync':
                from = initPath("-f", "--from");
                to = initPath("-t", "--to");
                dest = initPath("-d", "--dest");

                await FolderUtil.sync(from, to, dest, options);

                break;
            default:
                console.log(`unknown command ${command}`);

                break;
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

FolderHashCLI(process.argv.slice(2))
