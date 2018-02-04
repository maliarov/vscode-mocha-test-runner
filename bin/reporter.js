const path = require('path');
const crypto = require('crypto');

let id = 0;

const mochaModulePath = path.join(process.cwd(), 'node_modules', 'mocha');
const mocha = require(mochaModulePath);

module.exports = Reporter;

function Reporter(runner) {
    mocha.reporters.Base.call(this, runner);
    runner.suite.title = 'root';

    testsTree(runner);
    testsResult(runner);
}

function testsTree(runner) {
    send('tests::tree', buildTree(runner.suite));
}

function testsResult(runner) {
    runner.on('start', () => send('tests::start'));
    runner.on('suite', (suite) => send('suite::start', {id: suite.id}));
    runner.on('test', (test) => send('test::start', {id: test.id}));
    runner.on('pass', (test) => send('test::success', {id: test.id}));
    runner.on('fail', (test, error) => send('test::fail', {id: test.id, error}));
    runner.on('pending', (test) => send('test::pending', {id: test.id}));
    runner.on('test end', (test) => send('test::end', {id: test.id}));
    runner.on('suite end', (suite) => send('suite::end', {id: suite.id}));
    runner.on('end', () => send('tests::end'));
}

function send(command, payload) {
    console.log(JSON.stringify({command, payload}));
}

function buildTree(object) {
    return trevelOverSuites(object);
}

function trevelOverSuites(object, parent) {
    object.id = (id++).toString();

    const node = {
        id: object.id,
        type: object.type,
        title: object.title,
        file: object.file
    };

    object.tests.forEach((test) => {
        test.id = (id++).toString()
    });

    node.tests = object.tests.map((test) => ({
        id: test.id,
        type: test.type,
        title: test.title,
        file: test.file
    }));

    node.suites = object.suites.map((suite) => trevelOverSuites(suite, node));

    return node;
}