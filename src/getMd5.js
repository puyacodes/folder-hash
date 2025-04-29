import crypto from 'crypto';

function getMd5(input) {
    return crypto.createHash('md5').update(input).digest('hex');
}

export default getMd5;