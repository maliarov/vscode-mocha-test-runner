import * as path from 'path';
import * as vscode from 'vscode';

import TestState from './models/TestState';
import Test from './models/Test';
import Suite from './models/Suite';
import Tests from './models/Tests';

export default class MochaTreeDataProvider implements vscode.TreeDataProvider<string> {
    private changeTreeDataEmmiter: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();

    private context: vscode.ExtensionContext;
    private tests: Tests;

    readonly onDidChangeTreeData: vscode.Event<string | null> = this.changeTreeDataEmmiter.event;

    constructor(context: vscode.ExtensionContext, tests: Tests) {
        this.context = context;
        this.tests = tests;

        this.tests.onChanged((offset?: string) => {
            this.changeTreeDataEmmiter.fire(offset);
        });
    }

    getTreeItem(offset: string): vscode.TreeItem {
        const test: Test = this.tests.getById(offset);
        if (!test) {
            return null;
        }

        const collapsibleState: vscode.TreeItemCollapsibleState =
            (test instanceof Suite)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

        let treeItem: vscode.TreeItem;

        treeItem = new vscode.TreeItem(test.title, collapsibleState);
        treeItem.iconPath = this.getTreeItemStateIcon(test);

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

        /*
        if (node.error) {
            treeItem.command = {
                command: 'extension.showTestPreview',
                title: 'Show test preview',
                arguments: [node.id]
            };
        }
        */

        return treeItem;
    }

    getChildren(offset?: string): Thenable<string[]> {
        if (!offset) {
            return Promise.resolve([this.tests.getRoot().id]);
        }

        const node: Test = this.tests.getById(offset);
        if (!node) {
            return Promise.resolve(null);
        }

        if (node instanceof Suite) {
            return Promise.resolve([
                ...node.suites.map((suite) => suite.id),
                ...node.tests.map((test) => test.id)
            ]);
        }

        return Promise.resolve(null);
    }

    getTreeItemStateIcon(test: Test): string {
        if ([TestState.success, TestState.fail, TestState.progress, TestState.pending].indexOf(test.state) === -1) {
            return null;
        }

        const iconFileName: string = `icon-${test.state.toString()}.png`;
        return this.context.asAbsolutePath(path.join('assets', 'default', iconFileName));
    }
}
