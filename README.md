# Puya Folder Hash Utility
`@puya/fh` is a tool that creates a hash for a directory based on the sub-directories/files located in it.

## Story
As developers we all remember the troubles of building/transfering files from a published folder in a dev machine to a folder in a production server.

No matter how sharp we track the files we change during developement so that only copy them to production server not the whole published folder, we are all ended up creating a zip file, transfer it to production server, extract it there in the root of a website and free ourselves.

The slow transfer is painful, but the result is right at target (no errors - God willing -, all old files are replaced by their new updated version).

The issue resolved, but we always asked ourselves at the end of the day, couldn't be there a tool by which we could copy/transfer only the changed files, not the whole publish folder?

`@puya/fh` was created to help answering exactly this need.

## Description
`@puya/fh` has two main features:

- Generating a `json` file for a folder based on its content.
- Comparing two json files and generate a change list.

The generated json for a given directory can be used to ...

- compare the directory with another directory
- produce a report based on the differences between two directories
- create a batch file to copy missing file/folders
- copy the changes directly.
- compress changes into a single zip file

With these capabilities at hand, the problem described in `Story` section can be easily resolved.

1. We generate a json for our application folder in the production server.
2. Bring the json to our dev machine.
3. Compare the json with our local folder and create a compressed file out of the changes
6. Transfer the compressed file to production.
7. Extract it there at the root of our app.

We can now transfer only the changed files to the production server.

## Install
```bash
npm i @puya/fh -g
```

## Usage
### CLI

Base usage:
```bash
fh [command] [args] [options]
```

command:
- `hash`: generates json file for a folder based on its content.
- `diff`: checks the differences between two folders
- `apply`: copies the differences between two folders to a target directory.

`[args]` depend on `[command].

`[options]`:
- `-ed` or `--exclude-dirs`: specify a comma separated list of excluded folders that should be ignored.
- `-ef` or `--exclude-files`: specify a comma separated list of excluded files that should be ignored.
- `-id` or `--include-dirs`: specify a comma separated list of included folders that should not be ignored.
- `-if` or `--include-files`: specify a comma separated list of excluded files that should not be ignored.
- `-q` or `-quiet`: quiet mode (do not show output messages in console)
- `-ns` or `--no-sort`: do not sort folder/files
- `-dbm` or `--debug-mode`: debug mode
- `-dp` or `--deep`: show deep details

Other args:
- `-?` or `--help`: show help
- `-v` or `--version`: show the tool version number

Notes:
- `include` lists have more priority over `exclude` lists.
- If an exclude/include list starts with comma, the list will be added to the default exclude/include list, otherwise it will replace it.
- For each file it generates an `md5` hash.
- For sub-directories, it generates the `md5` based on the content of a sub-directory.

Using `@puya/fh` in CLI is described in details a little furthur.

### Development
```javascript
import { FolderUtil } from "@puya/fh";

const json = FolderUtil.getHash(dir);

console.log(json.hash);
```

## CLI Usage
### hash

Args:
- `-d` or `--dir`: path of directory for which hash should be generated (could be an absolute or relative path).
- `-o` or `--output`: path/name of generated json file.

example 1: create hash for current directory
```bash
fh
```

example 2: create hash for `/publish` folder in current directory
```bash
fh hash -d ./publish
```

example 3: create hash for `/publish` folder as `hash.json`
```bash
fh hash -d ./publish -o hash.json
```

example 4: create hash for `/publish` folder in current directory, do not sort file/folders
```bash
fh hash -d ./publish -ns
```

example 5: create hash for `/publish` folder in current directory, quiet mode.
```bash
fh hash -d ./publish -q
```

### diff
Args:
- `-f` or `--from`: (relative/absolute) path of `from` or `source` folder (the folder we are comparing to) or (relative/absolute) path of its json.
- `-t` or `--to`: (relative/absolute) path of `to` or `destination` folder (the folder we are comparing) or (relative/absolute) path of its json.
- `-rf` or `--relative-from`: a path for `from` folder that will be used in generated batch or `apply` command (copying files/folders) for source file/dirs.
- `-rt` or `--relative-to`: a path for `to` folder that will be used in generated batch or `apply` command (copying files/folders) for destination file/dirs.
- `-k` or `--kind`: kind of operation to be performed on detected changes.
  - `cmd`: generate a windows `.bat` file to copy changes.
  - `bash`: generate a linux `.sh` file to copy changes.
  - `report`: report or show changes.

example 1: compare `./dev` to `./prod` directories, report changes

```bash
fh diff -f ./dev -t ./prod
```

example 2: compare `dev.json` to `prod.json` hash files, report changes

```bash
fh diff -f dev.json -t prod.json
```

example 3: compare `./dev` to `prod.json`, report changes
```bash
fh diff -f ./dev -t prod.json
```

example 4: compare `./dev` to `./prod` directories, generate cmd batch file
```bash
fh diff -f ./dev -t ./prod -k cmd
```

example 5: compare `./dev` to `./prod` directories, generate bash file named `ch20250512.sh`
```bash
fh diff -f ./dev -t ./prod -k bash -o ch20250512.sh
```

example 6: compare `./dev` to `prod.json`, generate cmd batch file named `ch20250512.bat` relative to `./publish` dir
```bash
fh diff -f ./dev -t prod.json -rt ./publish -k cmd -o ch20250512.bat
```

### apply
Args:
arguments are the same as those used in `diff` command.

example 1: compare ./dev to ./prod directories, apply changes from './dev' into './prod'.
```bash
    fh apply -f ./dev -t ./prod
```

example 2: compare ./dev to prod.json, copy into -rt
```bash
    fh apply -f ./dev -t ./prod -rt ./publish
```

## Included/Excluded files/folders
There are a default list of files and folders that `@puya/fh` ignores them by default.

default excluded folders
- node_modules
- .git
- tests
- __tests__
- packages
- wwwroot
- coverage
- .vscode
- .idea
- build
- publish
- .vs

Excluded files:
- thumbs.db
- package.json
- packages.config
- .env
- .gitignore
- .ds_store
- *.log
- *.test.js
- *.spec.js
- *.bak
- *.tmp
- sync.bat
- sync.sh

These lists can be customized through cli arguments.

Copy new changeset into the container:
	docker cp changeset.zip my_app:/app/

Extract new changeset inside the container
	docker exec container_name unzip /app/changeset.zip -d /app/

Run @puya/fh Inside the Container
	docker exec container_name puya-fh generate /app/changes.json /app/

Copy the JSON File to the Host
	docker cp container_name:/app/changes.json ./changes.json


Compare the JSON with the New Version of the App
	puya-fh generate ./new_version.json ./new_version_folder/

	puya-fh compare ./changes.json ./new_version.json
