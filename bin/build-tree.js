const fs = require('fs');
const path = require('path');
const Mocha = require(path.join(process.cwd(), 'node_modules', 'mocha'));

const mocha = new Mocha();

const testsRootPath = 'test';
const testFileExt = '.spec.js';

fs.readdir(testsRootPath, (err, allFiles) => {
    if (err) {
        console.error(err);
        return process.exit(1);
    }

    const testsFiles = allFiles
        .filter((file) => file.endsWith(testFileExt))
        .map((file) => path.join(testsRootPath, file));

    testsFiles.forEach((file) => mocha.addFile(file));

    const opts = loadOptions();

    const compilers = opts.indexOf('--compilers');
    if (compilers !== -1) {
        const compiler = opts[compilers + 1];

        const idx = compiler.indexOf(':');
        const ext = compiler.slice(0, idx);

        let mod = compiler.slice(idx + 1);

        if (mod[0] === '.') {
            mod = path.join(process.cwd(), mod);
        } else {
            mod = path.join(process.cwd(), 'node_modules', mod);
        }

        require(mod);
    }

    mocha.loadFiles();

    trevelOverSuites(mocha.suite);
});


function trevelOverSuites(object, prefix = '') {
    prefix = (prefix ? prefix + ' ' : '') + '[suite] {' + object.title + '}';

    console.log(prefix);

    if (object.suites) {
        for (let s = 0; s < object.suites.length; s++) {
            trevelOverSuites(object.suites[s], prefix);
        }
    }

    object.tests && object.tests.forEach((test) => {
        console.log(prefix + ' ' + '[test] {' + test.title + '}');
    })
}


function loadOptions() {
    const optsPath = path.join(testsRootPath, 'mocha.opts');

    return fs
        .readFileSync(optsPath, 'utf8')
        .replace(/\\\s/g, '%20')
        .split(/\s/)
        .filter(Boolean)
        .map(value => value.replace(/%20/g, ' '));
}


        /*
        const runner = this.mocha.run((failures) => {
            process.on('exit', () => {
                process.exit(failures);  // exit with non-zero status if there were failures
                process.chdir(cwd);
            });
        });
        console.log('runner', runner);



        runner.on('start', (e) => {
            console.log('start', e);
        });
        runner.on('end', (e) => {
            console.log('end', e);
            process.chdir(cwd);
        });
        runner.on('suite', (e) => {
            console.log('suite', e);
        });
        runner.on('suite end', (e) => {
            console.log('suite end', e);
        });
        runner.on('test', (e) => {
            console.log('test', e);
        });
        runner.on('test end', (e) => {
            console.log('test end', e);
        });
        runner.on('hook', (e) => {
            console.log('hook', e);
        });
        runner.on('hook end', (e) => {
            console.log('hook end', e);
        });
        runner.on('pass', (e) => {
            console.log('pass', e);
        });
        runner.on('fail', (e) => {
            console.log('fail', e);
        });
        runner.on('pending', (e) => {
            console.log('pending', e);
        });

        // *   - `start`  execution started
        // *   - `end`  execution complete
        // *   - `suite`  (suite) test suite execution started
        // *   - `suite end`  (suite) all tests (and sub-suites) have finished
        // *   - `test`  (test) test execution started
        // *   - `test end`  (test) test completed
        // *   - `hook`  (hook) hook execution started
        // *   - `hook end`  (hook) hook complete
        // *   - `pass`  (test) test passed
        // *   - `fail`  (test, err) test failed
        // *   - `pending`  (test) test pending
        */
