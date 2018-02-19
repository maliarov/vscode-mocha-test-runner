import TestState from './TestState';
import Suite from './Suite';
import Tests from './Tests';


export default class Test {
    owner: Tests;
    parent: Suite;

    id: string;
    state: TestState = TestState.idle;

    title: string;
    file: string;
    error?: object;

    constructor(owner: Tests, id: string, title: string, file: string) {
        this.owner = owner;
        this.id = id;
        this.title = title;
        this.file = file;
    }
}