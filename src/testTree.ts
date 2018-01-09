import * as vscode from 'vscode';
import * as path from 'path';
import ICommonState from './ICommonState';

export default class MochaTreeDataProvider implements vscode.TreeDataProvider<string> {
    private context: vscode.ExtensionContext;
    private state: ICommonState;

    private _onDidChangeTreeData: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();
    readonly onDidChangeTreeData: vscode.Event<string | null> = this._onDidChangeTreeData.event;

    constructor(context: vscode.ExtensionContext, state: ICommonState) {
        this.context = context;
        this.state = state;
    }

    updateTreeNode(id?: string): void {
        this._onDidChangeTreeData.fire(id);
    } 

    getTreeItemStateIcon(node): string {
        if (['pass', 'fail', 'progress', 'pending'].indexOf(node.state) === -1) {
            return null;
        }

        return this.context.asAbsolutePath(path.join('assets', 'default', `icon-${node.state}.png`));
    }

    getTreeItem(offset: string): vscode.TreeItem {
        const node: any = this.state.map && this.state.map[offset];
        if (!node) {
            return null;
        }

        const collapsibleState: vscode.TreeItemCollapsibleState =
            (Array.isArray(node.suites) && node.suites.length) || (Array.isArray(node.tests) && node.tests.length)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

        let treeItem: vscode.TreeItem;

        treeItem = new vscode.TreeItem(node.title, collapsibleState);
        treeItem.iconPath = this.getTreeItemStateIcon(node);

        /*
        if (node.file) {
            treeItem.command = {
                command: 'vscode.open',
                title: 'Go to test',
                arguments: [vscode.Uri.file(node.file)]
            };

            //treeItem.contextValue = valueNode.type;
        }
        */

        if (node.error) {
            treeItem.command = {
                command: 'extension.showTestPreview',
                title: 'Show test preview',
                arguments: [node.id]
            };
        }


        return treeItem;
    }

    getChildren(offset?: string): Thenable<string[]> {
        if (!this.state.tree) {
            return Promise.resolve([]);
        }

        if (!offset) {
            return Promise.resolve([this.state.tree.id]);
        }

        const node: any = this.state.map && this.state.map[offset];
        if (!node) {
            return Promise.resolve([]);
        }

        return Promise.resolve([
            ...(Array.isArray(node.suites) && node.suites.length ? node.suites.map((suite) => suite.id) : []),
            ...(Array.isArray(node.tests) && node.tests.length ? node.tests.map((test) => test.id) : [])
        ]);
    }
}
