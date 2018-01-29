import * as vscode from 'vscode';

import TestState from './TestState';
import TestStateMap from './TestStateMap';
import Test from './Test';
import Suite from './Suite';

declare type OnNodeHandler = (test: Test) => void;


export default class Tests {
    private сhangedEmmiter: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();

    private tree: Suite;
    private map: Map<string, Test>;

    readonly onChanged: vscode.Event<string | null> = this.сhangedEmmiter.event;

    constructor() {
        this.reset();
    }


    reset(): void {
        this.tree = new Suite(this, 'root', 'root', null);
        this.map = new Map<string, Test>();
        this.map[this.tree.id] = this.tree;
    }

    parse(data: any): void {
        this.reset();
        this.buildTree(data);
        this.buildIndexes();
        this.сhangedEmmiter.fire();
    }

    getRoot(): Suite {
        return this.tree;
    }

    getById(id: string): Test {
        return this.map[id];
    }

    setState(id: string, state: TestState): void {
        const test: Test = this.getById(id);
        if (!test) {
            return;
        }

        if (test instanceof Suite) {
            const suite: Suite = <Suite>test;

            suite.tests.forEach((test) => test.state = state);
            suite.suites.forEach((suite) => suite.state = state);
        }

        test.state = state;

        this.сhangedEmmiter.fire(test.id);
    }

    updateState(id: string): void {
        const root: Test = this.getById(id);
        if (!(root instanceof Suite)) {
            return;
        }

        const stateMap: TestStateMap = {
            success: 0,
            fail: 0,
            pending: 0
        };

        this.travelOverTree(root, (test: Test) => {
            if (test instanceof Suite) {
                return;
            }
            stateMap[test.state.toString()] =  stateMap[test.state.toString()] + 1;
        });

        if (stateMap.success && !stateMap.fail) {
             root.state = TestState.success;
        } else if (stateMap.fail) {
            root.state = TestState.fail;
        } else if (stateMap.pending && !stateMap.fail && !stateMap.success) {
            root.state = TestState.pending;
        }

        this.сhangedEmmiter.fire(root.id);
    }

    private buildTree(data: any, parent: Suite = this.getRoot()): void {
        const testsData: any[] = data.tests || [];
        const suitesData: any[] = data.suites || [];

        testsData.forEach((testData: any) => {
            const test: Test = new Test(this, testData.id, testData.title, testData.file);
            parent.addChild(test);
        });

        suitesData.forEach((suiteData: any) => {
            const suite: Suite = new Suite(this, suiteData.id, suiteData.title, suiteData.file);
            parent.addChild(suite);

            this.buildTree(suiteData, suite);
        });
    }

    private buildIndexes(): void {
        this.travelOverTree(this.tree, (test: Test) => {
            this.map[test.id] = test
        });
    }

    private travelOverTree(suite: Suite, onNode: OnNodeHandler): void {
        onNode(suite);
        suite.tests.forEach((test: Test) => onNode(test));
        suite.suites.forEach((suite: Suite) => this.travelOverTree(suite, onNode));
    }
}