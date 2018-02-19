import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import TestState from './TestState';
import TestStateMap from './TestStateMap';
import Test from './Test';
import Suite from './Suite';
import RootSuite from './RootSuite';

declare type OnNodeHandler = (test: Test) => void;


export default class Tests {
    private сhangedEmmiter: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();

    private tree: RootSuite;
    private map: Map<string, Test>;
    private total: number = 0;

    readonly onChanged: vscode.Event<string | null> = this.сhangedEmmiter.event;

    constructor() {
        this.reset();
    }

    loadState() {
        const statePath: string = path.join(vscode.workspace.rootPath, '.vscode', 'mocha.tree.json');
        if (!fs.existsSync(statePath)) {
            return;
        }

        const data: any = JSON.parse(fs.readFileSync(statePath).toString());
        this.parse(data);
    }

    storeState() {
        const vscodePath: string = path.join(vscode.workspace.rootPath, '.vscode');
        const statePath: string = path.join(vscodePath, 'mocha.tree.json');

        if (!fs.existsSync(vscodePath)) {
            fs.mkdirSync(vscodePath);
        }

        try {
            const content: string = JSON.stringify(this.buildJson(), null, 2);
            fs.writeFileSync(statePath, content);
        } catch (err) {
            console.error(err);
        }
    }

    getTotal(): Number {
        return this.total;
    }

    reset(): void {
        this.tree = new RootSuite(this, 'root', 'root', null);
        this.map = new Map<string, Test>();
        this.map[this.tree.id] = this.tree;
        this.total = 0;
    }

    terminate(): void {
        this.travelOverTree(this.getRoot(), (test: Test) => {
            if (test instanceof Suite) {
                return;
            }

            if (test.state === TestState.progress) {
                test.state = TestState.terminated;
            }
        });

        this.updateState('root');
    }

    parse(data: any, parent: Suite = undefined): void {
        !parent && this.reset();
        this.buildTree(data, parent);
        this.buildIndexes();
        this.updateState(((parent && parent.id) || 'root'));
        this.updateRoot();
        this.сhangedEmmiter.fire('root');
    }

    getRoot(): RootSuite {
        return <RootSuite>this.tree;
    }

    getById(id: string): Test {
        return this.map[id];
    }

    setState(id: string, state: TestState): void {
        const test: Test = this.getById(id);
        if (!test) {
            return;
        }

        test.state = state;

        if (test instanceof Suite) {
            const suite: Suite = <Suite>test;

            suite.tests.forEach((test) => test.state = TestState.idle);
            suite.suites.forEach((suite) => this.setState(suite.id, TestState.idle));
        }

        this.сhangedEmmiter.fire(test.id);
    }

    updateRoot(): void {
        const root: RootSuite = this.getRoot();
        if (!root) {
            return;
        }

        const stateMap: TestStateMap = {
            success: 0,
            fail: 0,
            pending: 0,
            terminated: 0
        };

        this.travelOverTree(root, (test: Test) => {
            if (test instanceof Suite) {
                return;
            }

            if (!test.state) {
                return;
            }

            const key: string = test.state.toString();
            if (['success', 'fail', 'pending', 'terminated'].indexOf(key) === -1) {
                return;
            }

            stateMap[key] = stateMap[key] + 1;
        });

        root.stateMap = stateMap;

        this.сhangedEmmiter.fire(root.id);
    }


    getStateMap(id: string): TestStateMap {
        const stateMap: TestStateMap = {
            success: 0,
            fail: 0,
            pending: 0,
            terminated: 0
        };

        const root: Test = this.getById(id);
        if (!(root instanceof Suite)) {
            return stateMap;
        }

        this.travelOverTree(root, (test: Test) => {
            if (test instanceof Suite) {
                return;
            }

            if (!test.state) {
                return;
            }

            const key: string = test.state.toString();
            stateMap[key] = stateMap[key] + 1;
        });

        return stateMap;
    }

    updateState(id: string): void {
        const test: Test = this.getById(id);
        if (!test) {
            console.error(new Error(id));
            return;
        }
        const stateMap: TestStateMap = this.getStateMap(test.id);

        if (stateMap.success && !stateMap.fail && !stateMap.terminated) {
            test.state = TestState.success;
        } else if (stateMap.fail) {
            test.state = TestState.fail;
        } else if (stateMap.pending && !stateMap.fail && !stateMap.success && !stateMap.terminated) {
            test.state = TestState.pending;
        } else if (stateMap.terminated) {
            test.state = TestState.terminated;
        }

        this.сhangedEmmiter.fire(test.id);
    }

    private buildTree(data: any, parent: Suite = this.getRoot()): void {
        const testsData: any[] = data.tests || [];
        const suitesData: any[] = data.suites || [];

        this.total = this.total + testsData.length;

        testsData.forEach((testData: any) => {
            const test: Test = new Test(this, testData.id, testData.title, testData.file);
            test.error = testData.error;
            test.state = <TestState>testData.state;

            parent.addChild(test);
        });

        suitesData.forEach((suiteData: any) => {
            const suite: Suite = new Suite(this, suiteData.id, suiteData.title, suiteData.file);
            suite.state = <TestState>suiteData.state;

            parent.addChild(suite);

            this.buildTree(suiteData, suite);
        });
    }

    private buildJson(json: any = {}, suite: Suite = this.getRoot()): object {
        const tests: Test[] = suite.tests || [];
        const suites: Suite[] = suite.suites || [];

        json.id = suite.id;
        json.title = suite.title;
        json.file = suite.file;
        json.state = suite.state;

        json.tests =
            Array.isArray(tests) && tests.length
                ? tests.map((test: Test) => ({id: test.id, title: test.title, file: test.file, error: test.error, state: test.state}))
                : null;

        json.suites =
            Array.isArray(suites) && suites.length
                ? suites.map((suite: Suite) => this.buildJson({}, suite))
                : null;

        return json;
    }


    private buildIndexes(): void {
        this.travelOverTree(<Suite>this.tree, (test: Test) => {
            this.map[test.id] = test
        });
    }

    private travelOverTree(suite: Suite, onNode: OnNodeHandler): void {
        onNode(suite);
        Array.isArray(suite.tests) && suite.tests.forEach((test: Test) => onNode(test));
        Array.isArray(suite.suites) && suite.suites.forEach((suite: Suite) => this.travelOverTree(suite, onNode));
    }
}