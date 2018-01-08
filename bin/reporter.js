const path = require('path');
const mochaModulePath = path.join(process.cwd(), 'node_modules', 'mocha');

const mocha = require(mochaModulePath);

module.exports = Reporter;

function Reporter(runner) {
    mocha.reporters.Base.call(this, runner);
    runner.suite.title = runner.suite.title || 'root';

    printTestsTree(runner);
    printTestsResult(runner);
}

function printTestsTree(runner) {
    console.log('<tree>');
    console.log(JSON.stringify(buildTree(runner.suite)));
    console.log('</tree>');
}

function printTestsResult(runner) {
    runner.on('suite', (suite) => {
        console.log(`suite-start ${id(suite)}`);
    });
    runner.on('suite end', (suite) => {
        console.log(`suite-end ${id(suite)}`);
    });


    runner.on('test', (test) => {
        console.log(`test-start ${id(test)}`);
    });
    runner.on('pass', (test) => {
        console.log(`test-pass ${id(test)}`);
    });
    runner.on('fail', (test, err) => {
        console.log(`test-fail ${id(test)}`);
        console.log(err);
        console.log(`/test-fail ${id(test)}`);
    });
    runner.on('pending', (test) => {
        console.log(`test-pend ${id(test)}`);
    });
    runner.on('test end', (test) => {
        console.log(`test-end ${id(test)}`);
    });


    runner.on('start', () => {
        //console.log('<report>');
    });

    runner.on('end', () => {
        //console.log('</report>');
        process.exit(0);
    });
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

    node.tests = object.tests.map((test) => ({id: getId(test.title, node.id), type: test.type, title: test.title, file: test.file}));
    node.suites = object.suites.map((suite) => trevelOverSuites(suite, node));

    return node;
}

function getId(value, parentValue) {
    return (parentValue ? parentValue + '|' : '') + new Buffer(value).toString('base64');
}

function id(object) {
    if (!object) {
        return '';
    }

    const prefix = id(object.parent);
    return (prefix ? prefix + '|' : '') + new Buffer(object.title).toString('base64');
}