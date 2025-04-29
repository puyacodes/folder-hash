import { isNullOrEmpty, isString } from "@locustjs/base";

function equals(str1, str2, ignoreCase = true) {
    let result = false;

    if (isString(str1) && isString(str2)) {
        result = ignoreCase ? str1.toLowerCase() == str2.toLowerCase(): str1 == str2;
    } else {
        result = isNullOrEmpty(str1) && isNullOrEmpty(str2);
    }

    return result;
}

if (String.prototype.equals === undefined) {
    String.prototype.equals = function (...args) {
        return equals(this, ...args);
    }
}

export { equals };