const fs = require('fs');
const path = require('path');
const { FolderUtil } = require('./dist');

async function hash(dir, outputName) {
    const x = await FolderUtil.getHash(dir, ({ fullPath, dir, state }) => {
        if (dir && state == 0) {
            console.log(fullPath)
        }
    });

    const output = path.join(process.cwd(), outputName);

    fs.writeFileSync(output, JSON.stringify(x, null, 4));
}
async function test0() {
    await hash('C:\\Users\\sw2\\source\\repos\\Projects\\tap.erp\\Tap.ERP.Api\\bin\\Debug\\net6.0\\publish', "output.json");
}
async function test1() {
    await hash('C:\\Users\\sw2\\source\\repos\\Projects\\tap.erp\\Tap.ERP.Api\\bin\\Debug\\net6.0\\publish', "output1.json");
    await hash('D:\\2', "output2.json");
}

async function test2() {
    const from = 'C:\\Users\\sw2\\source\\repos\\Projects\\tap.erp\\Tap.ERP.Api\\bin\\Debug\\net6.0\\publish';
    const to = 'D:\\2';

    const x = await FolderUtil.diff(from, to, "d:\\2");

    console.log(x)

    const output = path.join(process.cwd(), "sync.bat");

    fs.writeFileSync(output, x.join("\n"));
}

test2().then(console.log)
