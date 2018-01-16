import TestStateMap from './TestStateMap';
import TestState from './TestState';
import Test from './Test';
import Tests from './Tests';


export default class Suite extends Test {
    tests: Test[];
    suites: Suite[];

    constructor(id: string, title: string, file: string) {
        super(id, title, file);

        this.tests = [];
        this.suites = [];
    }

    setState(value: TestState): void {
        super.setState(value);

        this.tests.forEach((test) => test.setState(value));
        this.suites.forEach((suite) => suite.setState(value));
    }

    addChild(node: Test): void {
        if (node instanceof Suite) {
            this.suites.push(node);
        } else {
            this.tests.push(node);
        }

        node.parent = this;
    }

    getSateMap(): TestStateMap {
        const stateMap: TestStateMap = super.getStateMap();

        [...this.tests, ...this.suites]
            .reduce((memo: TestStateMap, test: Test) => {
                const map: TestStateMap = test.getStateMap();

                Object.keys(map).forEach((key) => {
                    memo[key] += map[key];
                });

                return memo;
            }, stateMap);

        return stateMap;
    }

}