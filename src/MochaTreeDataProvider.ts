import * as path from 'path';
import * as vscode from 'vscode';

import TestState from './models/TestState';
import TestStateMap from './models/TestStateMap';
import Test from './models/Test';
import Suite from './models/Suite';
import RootSuite from './models/RootSuite';
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
        const [offsetId, offsetChild] = offset.split(':');
        const test: Test = this.tests.getById(offsetId);
        if (!test) {
            return null;
        }

        if (offsetId === 'root' && offsetChild) {
            const stateMap: TestStateMap = this.tests.getRoot().stateMap;

            switch (offsetChild) {
                case 'state': {
                    const treeItem = new vscode.TreeItem('root/state', vscode.TreeItemCollapsibleState.Expanded);
                    return treeItem;
                }
                case 'progress': {
                    const count: number = stateMap.success + stateMap.fail + stateMap.pending + stateMap.terminated;
                    const title: string = `progress: ${count} of ${this.tests.getTotal()}`;
                    const treeItem = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
                    treeItem.iconPath = this.getTreeItemStateIcon(TestState.progress);
                    return treeItem;
                }
                case 'success': {
                    const title: string = `success: ${stateMap.success}`;
                    const treeItem = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
                    treeItem.iconPath = this.getTreeItemStateIcon(TestState.success);
                    return treeItem;
                }
                case 'fail': {
                    const title: string = `fail: ${stateMap.fail}`;
                    const treeItem = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
                    treeItem.iconPath = this.getTreeItemStateIcon(TestState.fail);
                    return treeItem;
                }
                case 'pending': {
                    const title: string = `pending: ${stateMap.pending}`;
                    const treeItem = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
                    treeItem.iconPath = this.getTreeItemStateIcon(TestState.pending);
                    return treeItem;
                }
                case 'terminated': {
                    const title: string = `terminated: ${stateMap.terminated}`;
                    const treeItem = new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.None);
                    treeItem.iconPath = this.getTreeItemStateIcon(TestState.terminated);
                    return treeItem;
                }
                default:
                    return null;
            }
        }

        const collapsibleState: vscode.TreeItemCollapsibleState =
            (test instanceof Suite)
                ? (test.id === 'root')
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None;

        let treeItem: vscode.TreeItem;

        treeItem = new vscode.TreeItem(test.title, collapsibleState);
        treeItem.iconPath = this.getTreeItemStateIcon(test.state);
        treeItem.contextValue = (test instanceof Suite) ? 'suite' : 'test';

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

        if (offset === 'root:state') {
            return Promise.resolve([
                'root:success',
                'root:fail',
                'root:pending',
                'root:terminated',
                'root:progress'
            ]);
        }

        const node: Test = this.tests.getById(offset);
        if (!node) {
            return Promise.resolve(null);
        }


        if (node instanceof Suite) {
            return Promise.resolve([
                ...(node.id === 'root')
                    ? ['root:state']
                    : [],
                ...node.suites.map((suite) => suite.id),
                ...node.tests.map((test) => test.id)
            ]);
        }

        return Promise.resolve(null);
    }

    getTreeItemStateIcon(state: TestState): string {
        if ([TestState.success, TestState.fail, TestState.progress, TestState.pending, TestState.terminated].indexOf(state) === -1) {
            return 'none';
        }

        const iconFileName: string = `icon-${state.toString()}.png`;
        return this.context.asAbsolutePath(path.join('assets', 'default', iconFileName));
    }
}
