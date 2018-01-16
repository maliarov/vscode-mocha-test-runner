const path = require('path');
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
    send('tests:tree', buildTree(runner.suite));
}

function testsResult(runner) {
    runner.on('start', () => send('tests::start'));
    runner.on('suite', (suite) => send('suite::start', {id: id(suite)}));
    runner.on('test', (test) => send('test::start', {id: id(test)}));
    runner.on('pass', (test) => send('test::success', {id: id(test)}));
    runner.on('fail', (test, error) => send('test::fail', {id: id(test), error}));
    runner.on('pending', (test) => send('test::pending', {id: id(test)}));
    runner.on('test end', (test) => send('test::end', {id: id(test)}));
    runner.on('suite end', (suite) => send('suite::end', {id: id(suite)}));
    runner.on('end', () => {
        send('tests::end');
        process.exit(0);
    });
}

function send(command, payload) {
    console.log(JSON.stringify({command, payload}));
}

function buildTree(object) {
    return trevelOverSuites(object);
}

function trevelOverSuites(object, parent) {
    const node = {
        id: getId(object.title, parent && parent.id),
        type: object.type,
        title: object.title,
        file: object.file
    };

    node.tests = object.tests.map((test) => ({
        id: getId(test.title, node.id),
        type: test.type,
        title: test.title,
        file: test.file
    }));

    node.suites = object.suites.map((suite) => trevelOverSuites(suite, node));

    return node;
}

function getId(value, parentValue) {
    return (parentValue ? parentValue + '|' : '') + (value === 'root' ? value : new Buffer(value).toString('base64'));
}


function id(object) {
    if (!object) {
        return '';
    }

    const prefix = id(object.parent);
    return (prefix ? prefix + '|' : '') + (object.title === 'root' ? object.title : new Buffer(object.title).toString('base64'));
}