import { isNullOrUndefined, isSomeString } from "@locustjs/base";

function containsAll(str, ...args) {
    let result = false;

    if (isSomeString(str)) {
        if (args.length) {
            result = true;

            const _str = str.toLowerCase();

            for (let arg of args) {
                const value = isNullOrUndefined(arg) ? "" : arg.toString().toLowerCase();

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

    if (isSomeString(str) && args.length) {
        result = false;

        const _str = str.toLowerCase();

        for (let arg of args) {
            const value = isNullOrUndefined(arg) ? "" : arg.toString().toLowerCase();

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
    }
}

if (String.prototype.containsAll === undefined) {
    String.prototype.containsAll = function (...args) {
        return containsAll(this, ...args);
    }
}

if (String.prototype.containsAny === undefined) {
    String.prototype.containsAny = function (...args) {
        return containsAny(this, ...args);
    }
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
    }
}

export { containsAll, containsAny };