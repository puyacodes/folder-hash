import fs from "fs";
import crypto from 'crypto';

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

export default getFileMd5