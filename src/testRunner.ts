import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';


export default class MochaTestRunner implements vscode.TreeDataProvider<string> {
    private tree: string[];
    private context: vscode.ExtensionContext;

    private _onDidChangeTreeData: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();
    readonly onDidChangeTreeData: vscode.Event<string | null> = this._onDidChangeTreeData.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    getTreeItem(offset: string): vscode.TreeItem {
        const treeItem: vscode.TreeItem = new vscode.TreeItem(offset, vscode.TreeItemCollapsibleState.None);

        // treeItem.command = {
        //     command: 'extension.buildTestsTree',
        //     title: 'say hello',
        //     arguments: [],
        //     tooltip: 'test'
        // };

        //treeItem.iconPath = this.getIcon(valueNode);
        //treeItem.contextValue = valueNode.type;

        return treeItem;
    }

    getChildren(offset?: string): Thenable<string[]> {
        if (this.tree) {
            return Promise.resolve(this.tree);
        }

        return Promise.resolve([]);
    }


    buildTestsTree() {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(this.context.extensionPath, 'bin', 'build-tree.js');
            const buildTree = spawn('node', [scriptPath], { cwd: vscode.workspace.rootPath });

            this.tree = [];
            let error;

            buildTree.stdout.on('data', (data) => {
                data.toString().split('\n').forEach((line) => {
                    this.tree.push(line);
                });
                console.log('[buildtree]', data.toString());
            });
            buildTree.stderr.on('data', (data) => {
                this.tree = ['error'];
                error = new Error(data.toString());
                console.error('[buildtree]');
            });
            buildTree.on('close', (code) => {
                this._onDidChangeTreeData.fire();
                code ? reject(error) : resolve();
                console.log('[buildtree::close]', code);
            });
        });
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
