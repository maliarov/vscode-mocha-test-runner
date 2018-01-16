import * as fs from 'fs';
import * as path from 'path';

interface MochaOptionInfo {
    name: string[],
    param?: string,
    comment?: string,
    ignore?: boolean
}

const mochaOptsMap: Map<string, MochaOptionInfo> = assembleMochaOptionsInfo();

export function parseOptsFile(filePath) {
    try {
        const opts = fs
            .readFileSync(filePath, 'utf8')
            .replace(/\\\s/g, '%20')
            .split(/\s/)
            .filter(Boolean)
            .map(value => value.replace(/%20/g, ' '));

        return opts;
    } catch (err) {
        throw new Error('something wrong with mocha.opts file');
    }
}

export function filterOpts(opts: string[], all: boolean = true): string[] {
    const result = [];

    let i: number = 0;
    while (i < opts.length) {
        const optName: string = opts[i];
        const meta: MochaOptionInfo = mochaOptsMap[optName];

        if (meta) {
            if (meta.ignore) {
                i = i + 1 + (meta.param ? 1 : 0);
                continue;
            }

            result.push(opts[i]);
            i++;

            if (meta.param) {
                result.push(opts[i]);
                i++;
            }

            continue;
        }

        if (!all) {
            result.push(opts[i]);
        }

        i++;
    }

    return result;
}

function assembleMochaOptionsInfo(): Map<string, MochaOptionInfo> {
    const opts = new Map<string, MochaOptionInfo>();

    ign({name: ['-V', '--version'], comment: 'output the version number'});
    ign({name: ['-A', '--async-only'], comment: 'force all tests to take a callback (async) or return a promise'});
    ign({name: ['-c', '--colors'], comment: 'force enabling of colors'});
    ign({name: ['-C', '--no-colors'], comment: 'force disabling of colors'});
    ign({name: ['-G', '--growl'], comment: 'enable growl notification support'});
    ign({name: ['-O', '--reporter-options'], param: '<k=v,k2=v2,...>', comment: 'reporter-specific options'});
    ign({name: ['-R', '--reporter'], param: '<name>', comment: 'specify the reporter to use'});
    add({name: ['-S', '--sort'], comment: 'sort test files'});
    add({name: ['-b', '--bail'], comment: 'bail after first test failure'});
    ign({name: ['-d', '--debug'], comment: 'enable node\'s debugger, synonym for node --debug'});
    ign({name: ['-g', '--grep'], param: '<pattern>', comment: 'only run tests matching <pattern>'});
    ign({name: ['-f', '--fgrep'], param: '<string>', comment: 'only run tests containing <string>'});
    ign({name: ['-gc', '--expose-gc'], comment: 'expose gc extension'});
    ign({name: ['-i', '--invert'], comment: 'inverts --grep and --fgrep matches'});
    add({name: ['-r', '--require'], param: '<name>', comment: 'require the given module'});
    add({name: ['-s', '--slow'], param: '<ms>', comment: '"slow" test threshold in milliseconds [75]'});
    add({name: ['-t', '--timeout'], param: '<ms>', comment: 'set test-case timeout in milliseconds [2000]'});
    ign({name: ['-u', '--ui'], param: '<name>', comment: 'specify user-interface (bdd|tdd|qunit|exports)'});
    ign({name: ['-w', '--watch'], comment: 'watch files for changes'});
    ign({name: ['--check-leaks'], comment: 'check for global variable leaks'});
    add({name: ['--full-trace'], comment: 'display the full stack trace'});
    add({name: ['--compilers'], param: '<ext>:<module>,...', comment: 'use the given module(s) to compile files'});
    ign({name: ['--debug-brk'], comment: 'enable node\'s debugger breaking on the first line'});
    add({name: ['--globals'], param: '<names>', comment: 'allow the given comma-delimited global [names]'});
    add({name: ['--es_staging'], comment: 'enable all staged features'});
    add({name: ['--harmony<_classes,_generators,...>'], comment: 'all node --harmony* flags are available'});
    add({name: ['--preserve-symlinks'], comment: 'Instructs the module loader to preserve symbolic links when resolving and caching modules'});
    ign({name: ['--icu-data-dir'], comment: 'include ICU data'});
    ign({name: ['--inline-diffs'], comment: 'display actual/expected differences inline within each string'});
    ign({name: ['--inspect'], comment: 'activate devtools in chrome'});
    ign({name: ['--inspect-brk'], comment: 'activate devtools in chrome and break on the first line'});
    ign({name: ['--interfaces'], comment: 'display available interfaces'});
    ign({name: ['--no-deprecation'], comment: 'silence deprecation warnings'});
    ign({name: ['--exit'], comment: 'force shutdown of the event loop after test run: mocha will call process.exit'});
    ign({name: ['--no-timeouts'], comment: 'disables timeouts, given implicitly with --debug'});
    ign({name: ['--no-warnings'], comment: 'silence all node process warnings'});
    ign({name: ['--opts'], param: '<path>', comment: 'specify opts path'});
    ign({name: ['--perf-basic-prof'], comment: 'enable perf linux profiler (basic support)'});
    ign({name: ['--napi-modules'], comment: 'enable experimental NAPI modules'});
    ign({name: ['--prof'], comment: 'log statistical profiling information'});
    ign({name: ['--log-timer-events'], comment: 'Time events including external callbacks'});
    ign({name: ['--recursive'], comment: 'include sub directories'});
    ign({name: ['--reporters'], comment: 'display available reporters'});
    ign({name: ['--retries'], param: '<times>', comment: 'set numbers of time to retry a failed test case'});
    ign({name: ['--throw-deprecation'], comment: 'throw an exception anytime a deprecated function is used'});
    ign({name: ['--trace'], comment: 'trace function calls'});
    ign({name: ['--trace-deprecation'], comment: 'show stack traces on deprecations'});
    ign({name: ['--trace-warnings '], comment: 'show stack traces on node process warnings'});
    add({name: ['--use_strict'], comment: 'enforce strict mode'});
    ign({name: ['--watch-extensions'], param: '<ext>,...', comment: 'additional extensions to monitor with --watch'});
    add({name: ['--delay'], comment: 'wait for async suite definition'});
    ign({name: ['--allow-uncaught'], comment: 'enable uncaught errors to propagate'});
    ign({name: ['--forbid-only'], comment: 'causes test marked with only to fail the suite'});
    ign({name: ['--forbid-pending'], comment: 'causes pending tests and test marked with skip to fail the suite'});
    ign({name: ['-h', '--help'], comment: 'output usage information'});

    return opts;


    function add(info: MochaOptionInfo): void {
        info.name.forEach((name) => {
            opts[name] = info;
        });
    }

    function ign(info: MochaOptionInfo): void {
        info.ignore = true;
        info.name.forEach((name) => {
            opts[name] = info;
        });
    }
}
