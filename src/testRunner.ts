'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {spawn} from 'child_process';
import MochaTreeDataProvider from './testTree';

const mochaOptsMap: Map<string, MochaOptionInfo> = assembleMochaOptionsInfo();

interface MochaOptionInfo {
    name: string[],
    param?: string,
    comment?: string,
    ignore?: boolean
}

export default class MochaTestRunner {
    private context: vscode.ExtensionContext;
    private tree: MochaTreeDataProvider;

    constructor(context: vscode.ExtensionContext, treeDataProvider: MochaTreeDataProvider) {
        this.context = context;
        this.tree = treeDataProvider;

        this.context.workspaceState.update('tree', null);
        this.context.workspaceState.update('map', null);
    }

    async run(fileName?: string) {
        if (this.context.workspaceState.get('tree')) {
            setNodeState(this.context.workspaceState.get('tree'), 'process');
            this.tree.updateTreeNode();
        }

        const spawnArgs = [
            ...await this.mochaScriptArgument(),
            '--full-trace',
            '--no-deprecation',
            ...await this.mochaOptsArgument(fileName),
            ...await this.mochaReporterArgument()
        ];
        const spawnOpts = {
            cwd: vscode.workspace.rootPath
        };

        console.log('mochaScriptArgument', [...await this.mochaScriptArgument()]);
        console.log('mochaOptsArgument', fileName, [...await this.mochaOptsArgument(fileName)]);

        const buildTree = spawn('node', spawnArgs, spawnOpts);

        return new Promise((resolve, reject) => {
            let treeJson: string = '';
            let error: string = '';
            let action: Function;

            buildTree.stdout.on('data', (data) => {
                const context = data.toString();
                const lines = context.split('\n');

                lines.forEach((line, lineIndex) => {
                    if (line === '<tree>') {
                        action = accumTreeJson;
                        return;
                    } else if (line === '</tree>') {
                        const tree = JSON.parse(treeJson);
                        this.context.workspaceState.update('tree', tree);
                        this.context.workspaceState.update('map', treeToMap(tree));
                        action = null;
                        this.tree.updateTreeNode();
                        return;
                    } else if (line.startsWith('test-fail')) {
                        const id = line.split(' ')[1];
                        const node = this.context.workspaceState.get<any>('map')[id];
                        if (node) {
                            action = accumError.bind(null, node);
                        }
                        return;
                    } else if (line.startsWith('/test-fail')) {
                        const id = line.split(' ')[1];
                        const node = this.context.workspaceState.get<any>('map')[id];
                        if (node) {
                            node.state = 'fail';
                            this.tree.updateTreeNode(node.id);
                        }
                        action = null;
                        return;
                    } else if (line.startsWith('test-pass')) {
                        const id = line.split(' ')[1];
                        const node = this.context.workspaceState.get<any>('map')[id];
                        if (node) {
                            node.state = 'pass';
                            this.tree.updateTreeNode(node.id);
                        }
                        return;
                    } else if (line.startsWith('test-pend')) {
                        const id = line.split(' ')[1];
                        const node = this.context.workspaceState.get<any>('map')[id];
                        if (node) {
                            node.state = 'pending';
                            this.tree.updateTreeNode(node.id);
                        }
                        return;
                    } else if (line.startsWith('suite-start') || line.startsWith('test-start')) {
                        const id = line.split(' ')[1];
                        const node = this.context.workspaceState.get<any>('map')[id];
                        if (node) {
                            node.state = 'progress';
                        }
                        return;
                    } else if (line.startsWith('suite-end')) {
                        const id = line.split(' ')[1];
                        const node = this.context.workspaceState.get<any>('map')[id];
                        if (node) {
                            const state = getNodeState(node);
                            if (state.pass && !state.fail) {
                                node.state = 'pass';
                            } else if (state.fail) {
                                node.state = 'fail';
                            } else if (state.pending && !state.fail && !state.pass) {
                                node.state = 'pending';
                            }
                            this.tree.updateTreeNode(node.id);
                        }
                        return;
                    }

                    action && action(line + ((lineIndex === lines.length - 1) ? '' : '\n'));
                });

            });

            buildTree.stderr.on('data', (data) => {
                this.context.workspaceState.update('tree', null);
                this.context.workspaceState.update('map', null);
                error += data.toString();
            });
            buildTree.on('close', (code) => {
                code ? reject(new Error(error)) : resolve();
            });


            function accumTreeJson(data) {
                treeJson += data;
            }
            function accumError(node, data) {
                node.error = node.error || '';
                node.error += data;
            }
        }).then(() => this.tree.updateTreeNode());
    }


    async mochaScriptArgument(): Promise<string[]> {
        const confMochaScriptPath = vscode.workspace.getConfiguration('mocha').get('path', '');
        if (confMochaScriptPath) {
            assert(fs.existsSync(confMochaScriptPath), 'path defined with [mocha.path] setting not exists');
            return [confMochaScriptPath];
        }

        const localMochaScriptPath = path.join(vscode.workspace.rootPath, 'node_modules', 'mocha', 'bin', 'mocha');
        if (fs.existsSync(localMochaScriptPath)) {
            return [localMochaScriptPath];
        }

        const globalMochaScriptPath = path.join(await npmRoot(true), 'mocha', 'bin', 'mocha');
        if (fs.existsSync(globalMochaScriptPath)) {
            return [globalMochaScriptPath];
        }

        throw Error('can not find local/global installed mocha packages or alternative provided by [mocha.path] setting');
    }

    async mochaOptsArgument(fileName?: string): Promise<string[]> {
        const confMochaOptsFilePath = vscode.workspace.getConfiguration('mocha').get('optsPath', '');
        if (confMochaOptsFilePath) {
            assert(fs.existsSync(confMochaOptsFilePath), 'path defined with [mocha.optsPath] setting not exists');
            const opts = filterMochaOpts(parseOptsFile(confMochaOptsFilePath), !!fileName);
            return [...opts, ...(fileName ? [fileName] : []), '--opts', path.join(this.context.extensionPath, 'bin', 'empty.mocha.opts')];
        }

        const localMochaOptsFilePath = path.join(vscode.workspace.rootPath, 'test', 'mocha.opts');
        if (fs.existsSync(localMochaOptsFilePath)) {
            const opts = filterMochaOpts(parseOptsFile(localMochaOptsFilePath), !!fileName);
            return [...opts, ...(fileName ? [fileName] : []), '--opts', path.join(this.context.extensionPath, 'bin', 'empty.mocha.opts')];
        }

        return [];
    }

    async mochaReporterArgument(): Promise<string[]> {
        return ['--reporter', path.join(this.context.extensionPath, 'bin', 'reporter.js')];
    }

    async mochaFilesArgument(): Promise<string[]> {
        return []
    }
}

// function promisify(fn: Function): Function {
//     return function (): Promise<any> {
//         return new Promise((resolve, reject) => {
//             const args = [...arguments, (err, result) => err ? reject(err) : resolve(result)];
//             fn.apply(null, args);
//         });
//     }
// }


function npmRoot(isGlobal): Promise<string> {
    return new Promise((resolve, reject) => {
        let output = '';
        let error = '';

        const npmProcess = spawn('npm', ['root', ...(isGlobal ? ['-g'] : [])]);

        npmProcess.stdout.on('data', (data) => output += data.toString());
        npmProcess.stderr.on('data', (data) => error += data.toString());
        npmProcess.on('close', (code) => code ? reject(error) : resolve(output.trim()));
    });
}

function treeToMap(tree, map = {}) {
    map[tree.id] = tree;
    tree.tests && tree.tests.forEach((test) => treeToMap(test, map));
    tree.suites && tree.suites.forEach((suite) => treeToMap(suite, map));
    return map;
}

function getNodeState(node, state = {pass: 0, fail: 0, pending: 0}) {
    Array.isArray(node.tests) && node.tests.length
        && node.tests.reduce((state, test) => {
            test.state && (state[test.state]++);
            return state;
        }, state);

    Array.isArray(node.suites) && node.suites.length
        && node.suites.forEach((suite) => getNodeState(suite, state));

    return state;
}

function setNodeState(node, state) {
    node.state = state;

    Array.isArray(node.tests) && node.tests.length && node.tests.forEach((test) => setNodeState(test, state));
    Array.isArray(node.suites) && node.suites.length && node.suites.forEach((suite) => setNodeState(suite, state));
}

function parseOptsFile(filePath) {
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

function filterMochaOpts(opts: string[], all: boolean = true): string[] {
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