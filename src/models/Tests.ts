import * as vscode from 'vscode';

import Test from './Test';
import Suite from './Suite';

export default class Tests {
    private nodeChangedEmmiter: vscode.EventEmitter<string | null> = new vscode.EventEmitter<string | null>();

    private tree: Suite;
    private map: Map<string, Test>;

    readonly onNodeChanged: vscode.Event<string | null> = this.nodeChangedEmmiter.event;

    constructor() {
        this.reset();
    }


    buildIndexes(): void {
        const self: Tests = this;
        travelOverTree(this.tree);
        
        function travelOverTree(suite: Suite) {
            self.map[suite.id] = suite;
            suite.tests.forEach((test: Test) => self.map[test.id] = test);
            suite.suites.forEach((suite: Suite) => travelOverTree(suite));
        }
    }

    reset(): void {
        this.tree = new Suite('root', 'root', null);
        this.map = new Map<string, Test>();
        this.map[this.tree.id] = this.tree;
    }

    emit(id?: string): void {
        this.nodeChangedEmmiter.fire(id);
    }

    getRoot(): Suite {
        return this.tree;
    }

    getById(id: string): Test {
        return this.map[id];
    }

    // setState(node: Node, state, isCascade: boolean) {
    //     node = node || this.tree;

    //     if (this.map[node.id] !== node) {
    //         return;
    //     }

    //     node.state = state;

    //     if (isCascade && node instanceof Suite) {
    //         const suiteNode: Suite = <Suite>node;

    //         Array.isArray(suiteNode.tests) && suiteNode.tests.length &&
    //             suiteNode.tests.forEach((testNode) => this.setState(testNode, state, isCascade));

    //         Array.isArray(node.suites) && node.suites.length &&
    //             node.suites.forEach((suiteNode) => this.setState(suiteNode, state, isCascade));
    //     }

    //     this.nodeChangedEmmiter.fire(node.id);
    // }

}