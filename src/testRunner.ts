import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';


export default class MochaTestRunner implements vscode.TreeDataProvider<string> {
    private tree: any;
    private map: any;

    private context: vscode.ExtensionContext;

    private _onDidChangeTreeData: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();
    readonly onDidChangeTreeData: vscode.Event<string | null> = this._onDidChangeTreeData.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.tree = null;
        this.map = null;
    }

    getTreeItem(offset: string): vscode.TreeItem {
        const offsetParts = offset.split('::');
        const realOffset = offsetParts[0];
        const virtualOffset = offsetParts[1];
        const node = this.map[realOffset];

        if (offsetParts.length === 1) {
            return new vscode.TreeItem(node.title, vscode.TreeItemCollapsibleState.Collapsed);
        }

        switch (virtualOffset) {
            case 'state': {
                const label = 'state' + (node.state ? ':' + node.state : '');
                return new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
            }

            case 'suites':
                return Array.isArray(node.suites) && node.suites.length
                    ? new vscode.TreeItem('suites', vscode.TreeItemCollapsibleState.Collapsed)
                    : null;

            case 'tests':
                return Array.isArray(node.tests) && node.tests.length
                    ? new vscode.TreeItem('tests', vscode.TreeItemCollapsibleState.Collapsed)
                    : null;

            default:
                return null;
        }

        // treeItem.command = {
        //     command: 'extension.buildTestsTree',
        //     title: 'say hello',
        //     arguments: [],
        //     tooltip: 'test'
        // };

        //treeItem.iconPath = this.getIcon(valueNode);
        //treeItem.contextValue = valueNode.type;

    }

    getChildren(offset?: string): Thenable<string[]> {
        if (!this.map) {
            return Promise.resolve([]);
        }

        if (!offset) {
            return Promise.resolve([this.tree.id]);
        }

        const offsetParts = offset.split('::');
        const realOffset = offsetParts[0];
        const virtualOffset = offsetParts[1];
        const node = this.map[realOffset];

        if (!node) {
            return Promise.resolve([]);
        }

        if (offsetParts.length === 1) {
            return Promise.resolve([
                node.id + '::state',
                ...(Array.isArray(node.suites) && node.suites.length ? [node.id + '::suites'] : []),
                ...(Array.isArray(node.tests) && node.tests.length ? [node.id + '::tests'] : []),
            ]);
        }

        switch (virtualOffset) {
            case 'suites':
                return Promise.resolve(node.suites.map((suite) => suite.id));

            case 'tests':
                return Promise.resolve(node.tests.map((test) => test.id));

            default:
                return Promise.resolve([]);
        }
    }

    async buildTestsTree() {
        this.tree = [];

        const spawnArgs = [
            ...await this.mochaScriptArgument(),
            ...await this.mochaOptsFileArgument(),
            ...await this.mochaReporterArgument()
        ];
        const spawnOpts = {
            cwd: vscode.workspace.rootPath
        };

        const buildTree = spawn('node', spawnArgs, spawnOpts);

        return new Promise((resolve, reject) => {
            let treeJson: string = '';
            let error: string = '';
            let action: Function;

            buildTree.stdout.on('data', (data) => {
                const str = data.toString().split('\n');

                str.forEach((line) => {
                    if (line === '<tree>') {
                        action = accumTreeJson;
                        return;
                    } else if (line === '</tree>') {
                        this.tree = JSON.parse(treeJson);
                        this.map = treeToMap(this.tree);
                        action = null;
                        this._onDidChangeTreeData.fire();
                        return;
                    } else if (line.startsWith('test-fail')) {
                        const id = line.split(' ')[1];
                        const node = this.map[id];
                        if (node) {
                            node.state = 'fail';
                            this._onDidChangeTreeData.fire(node.id + '::state');
                        }
                        return;
                    } else if (line.startsWith('test-pass')) {
                        const id = line.split(' ')[1];
                        const node = this.map[id];
                        if (node) {
                            node.state = 'pass';
                            this._onDidChangeTreeData.fire(node.id + '::state');
                        }
                        return;
                    } else if (line.startsWith('test-pend')) {
                        const id = line.split(' ')[1];
                        const node = this.map[id];
                        if (node) {
                            node.state = 'pend';
                            this._onDidChangeTreeData.fire(node.id + '::state');
                        }
                        return;
                    } else if (line.startsWith('suite-start') || line.startsWith('test-start')) {
                        const id = line.split(' ')[1];
                        const node = this.map[id];
                        if (node) {
                            node.state = '...';
                        }
                        return;
                    } else if (line.startsWith('suite-end')) {
                        const id = line.split(' ')[1];
                        const node = this.map[id];
                        if (node) {
                            const state = nodeState(node);
                            if (state.pass && !state.fail && !state.pend) {
                                node.state = 'pass';
                            } else if (state.fail && !state.pass && !state.pend) {
                                node.state = 'fail';
                            } else {
                                node.state = 'partial';
                            }
                            this._onDidChangeTreeData.fire(node.id + '::state');
                        }
                        return;
                    }

                    action && action(line);
                });

            });

            buildTree.stderr.on('data', (data) => {
                this.tree = null;
                this.map = null;
                error += data.toString();
            });
            buildTree.on('close', (code) => {
                code ? reject(new Error(error)) : resolve();
            });


            function accumTreeJson(data) {
                treeJson += data;
            }
        }).then(() => this._onDidChangeTreeData.fire());
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

    async mochaOptsFileArgument(): Promise<string[]> {
        const confMochaOptsFilePath = vscode.workspace.getConfiguration('mocha').get('optsPath', '');
        if (!confMochaOptsFilePath) {
            return Promise.resolve([]);
        }

        assert(fs.existsSync(confMochaOptsFilePath), 'path defined with [mocha.optsPath] setting not exists');
        return Promise.resolve(['--opts', confMochaOptsFilePath]);
    }

    async mochaReporterArgument(): Promise<string[]> {
        return Promise.resolve(['--reporter', path.join(this.context.extensionPath, 'bin', 'reporter.js')]);
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

function nodeState(node, state = { pass: 0, fail: 0, pend: 0 }) {
    Array.isArray(node.tests) && node.tests.length
        && node.tests.reduce((state, test) => {
            test.state && (state[test.state]++);
            return state;
         }, state);

    Array.isArray(node.suites) && node.suites.length
         && node.suites.forEach((suite) => nodeState(suite, state));

    return state;
}