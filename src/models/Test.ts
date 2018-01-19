import TestState from './TestState';
import TestStateMap from './TestStateMap';
import Suite from './Suite';
import Tests from './Tests';


export default class Test {
    owner: Tests;
    parent: Suite;

    id: string;
    state: TestState = TestState.idle;

    title: string;
    file: string;
    error?: string;

    constructor(owner: Tests, id: string, title: string, file: string) {
        this.owner = owner;
        this.id = id;
        this.title = title;
        this.file = file;
    }

    setState(value: TestState, emit: boolean = true): void {
        this.state = value;
        emit && this.owner.emit(this.id);
    }

    getStateMap(): TestStateMap {
        const map: TestStateMap = {
            success: 0,
            fail: 0,
            pending: 0
        };

        map[this.state.toString()] =  map[this.state.toString()] + 1;

        return map;
    }
}