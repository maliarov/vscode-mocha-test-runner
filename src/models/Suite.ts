import Test from './Test';
import Tests from './Tests';


export default class Suite extends Test {
    tests: Test[];
    suites: Suite[];

    constructor(owner: Tests, id: string, title: string, file: string) {
        super(owner, id, title, file);

        this.tests = [];
        this.suites = [];
    }

    addChild(node: Test): void {
        if (node instanceof Suite) {
            this.suites.push(node);
        } else {
            this.tests.push(node);
        }

        node.parent = this;
    }
}