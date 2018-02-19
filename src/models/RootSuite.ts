import TestStateMap from './TestStateMap';
import Suite from './Suite';
import Tests from './Tests';


export default class RootSuite extends Suite {
    
    stateMap: TestStateMap;
    
    constructor(owner: Tests, id: string, title: string, file: string) {
        super(owner, id, title, file);
        
        this.stateMap = {
            success: 0,
            fail: 0,
            pending: 0,
            terminated: 0
        };
    }
        
}