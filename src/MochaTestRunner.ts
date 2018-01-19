'use strict';

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as es from "event-stream";
import {spawn, ChildProcess} from 'child_process';

import TestStateMap from './models/TestStateMap';
import TestState from './models/TestState';
import Test from './models/Test';
import Suite from './models/Suite';
import Tests from './models/Tests';

import * as mocha from './mocha';
import * as npm from './npm';

interface Payload {
    id?: string
}

interface Command {
    command: string,
    payload?: Payload
}

export enum MochaTestRunnerStates {
    starting,
    start,
    startSuite,
    startTest,
    finishTest,
    finishSuite,
    stopping,
    stopped,
    fails
}

export interface MochaTestRunnerStateData {
    state: MochaTestRunnerStates;
    payload?: any;
}

export default class MochaTestRunner {
    private context: vscode.ExtensionContext;
    private childProcess: ChildProcess;
    private tests: Tests;

    private onChangeStateEmmiter: vscode.EventEmitter<MochaTestRunnerStateData>
        = new vscode.EventEmitter<MochaTestRunnerStateData>();

    public onChangeState: vscode.Event<MochaTestRunnerStateData> = this.onChangeStateEmmiter.event;

    constructor(context: vscode.ExtensionContext, tests: Tests) {
        this.context = context;
        this.tests = tests;
    }

    stop(): void {
        if (this.childProcess) {
            this.childProcess.unref();
            this.childProcess = null;
        }
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.stopped});
    }

    async run(fileName?: string): Promise<void> {
        this.tests.getRoot().setState(TestState.progress);
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.starting});

        const spawnArgs = [
            ...await this.mochaScriptArguments(),
            '--full-trace',
            '--no-deprecation',
            ...await this.mochaOptsArguments(fileName),
            ...await this.mochaReporterArguments()
        ];
        const spawnOpts = {
            cwd: vscode.workspace.rootPath
        };

        this.childProcess = spawn('node', spawnArgs, spawnOpts);

        return new Promise<void>((resolve, reject) => {
            this.childProcess.stdout
                .setEncoding('utf-8')
                .pipe(es.split('\n'))
                .pipe(es.parse())
                .pipe(es.map((command: Command, cb: Function) => {
                    Promise.resolve(this.onData(command)).then(cb.bind(this, null), (err) => cb(err));
                }));

            this.childProcess.stderr
                .setEncoding('utf-8')
                .on('data', (data) => {
                    console.error(data.toString());
                    //reject(new Error(data.toString()))
                });

            this.childProcess.on('close', (code) => code ? reject(code) : resolve());
        });
    }


    onData(command: Command): Promise<any> {
        switch (command.command) {
            case 'tests::tree': return this.onTestsTreeCommand(command.payload);

            case 'tests::start':
                return this.onTestsStartCommand();

            case 'suite::start': {
                const suite: Suite = <Suite>this.tests.getById(command.payload.id);
                if (!suite) {
                    return;
                }
                return this.onSuiteStartCommand(suite);
            }

            case 'test::start': {
                const test: Test = this.tests.getById(command.payload.id);
                if (!test) {
                    return;
                }
                return this.onTestStartCommand(test);
            }

            case 'test::success': {
                const test: Test = this.tests.getById(command.payload.id);
                if (!test) {
                    return;
                }
                return this.onTestSuccessCommand(test);
            }

            case 'test::fail': {
                const test: Test = this.tests.getById(command.payload.id);
                if (!test) {
                    return;
                }
                return this.onTestFailCommand(test, command.payload);
            }

            case 'test::pending': {
                const test: Test = this.tests.getById(command.payload.id);
                if (!test) {
                    return;
                }
                return this.onTestPendingCommand(test);
            }

            case 'test::end': {
                const test: Test = this.tests.getById(command.payload.id);
                if (!test) {
                    return;
                }
                return this.onTestEndCommand(test);
            }

            case 'suite::end': {
                const suite: Suite = <Suite>this.tests.getById(command.payload.id);
                if (!suite) {
                    return;
                }
                return this.onSuiteEndCommand(suite);
            }

            case 'tests::end': return this.onTestsEndCommand();
        }
    }

    async onTestsTreeCommand(tree: any): Promise<void> {
        this.travelOverNodes(tree, this.tests.getRoot());

        this.tests.buildIndexes();
        this.tests.emit();
    }
    
    travelOverNodes(node: any, parent: Suite): void {
        const tests: Test[] = node.tests.forEach((data: any) => {
            const test: Test = new Test(this.tests, data.id, data.title, data.file);
            parent.addChild(test);
        });

        const suites: Suite[] = node.suites.forEach((data: any) => {
            const suite: Suite = new Suite(this.tests, data.id, data.title, data.file);
            this.travelOverNodes(data, suite);
            parent.addChild(suite);
        });
    }



    async onTestsStartCommand(): Promise<void> {
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.start});
    }

    async onTestsEndCommand(): Promise<void> {
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.stopped});
    }

    async onTestStartCommand(test: Test): Promise<void> {
        test.setState(TestState.progress);
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.startTest, payload: test});
    }

    async onTestSuccessCommand(test: Test): Promise<void> {
        test.setState(TestState.success);
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: test});
    }

    async onTestFailCommand(test: Test, error: any): Promise<void> {
        test.setState(TestState.fail);
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: test});
    }

    async onTestPendingCommand(test: Test): Promise<void> {
        test.setState(TestState.pending);
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: test});
    }

    async onTestEndCommand(test: Test): Promise<void> {
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: test});
    }

    async onSuiteStartCommand(suite: Suite): Promise<void> {
        suite.setState(TestState.progress);
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.startSuite, payload: suite});
    }

    async onSuiteEndCommand(suite: Suite): Promise<void> {
        const stateMap: TestStateMap = suite.getSateMap();
        if (stateMap.success && !stateMap.fail) {
            suite.setState(TestState.success);
        } else if (stateMap.fail) {
            suite.setState(TestState.fail);
        } else if (stateMap.pending && !stateMap.fail && !stateMap.success) {
            suite.setState(TestState.pending);
        }
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishSuite, payload: suite});
    }


    async mochaScriptArguments(): Promise<string[]> {
        const confMochaScriptPath = vscode.workspace.getConfiguration('mocha').get('path', '');
        if (confMochaScriptPath) {
            assert(fs.existsSync(confMochaScriptPath), 'path defined with [mocha.path] setting not exists');
            return [confMochaScriptPath];
        }

        const localMochaScriptPath = path.join(vscode.workspace.rootPath, 'node_modules', 'mocha', 'bin', 'mocha');
        if (fs.existsSync(localMochaScriptPath)) {
            return [localMochaScriptPath];
        }

        const globalMochaScriptPath = path.join(await npm.root(true), 'mocha', 'bin', 'mocha');
        if (fs.existsSync(globalMochaScriptPath)) {
            return [globalMochaScriptPath];
        }

        throw Error('can not find local/global installed mocha packages or alternative provided by [mocha.path] setting');
    }

    async mochaOptsArguments(fileName?: string): Promise<string[]> {
        const confMochaOptsFilePath = vscode.workspace.getConfiguration('mocha').get('optsPath', '');
        if (confMochaOptsFilePath) {
            assert(fs.existsSync(confMochaOptsFilePath), 'path defined with [mocha.optsPath] setting not exists');
            const opts = mocha.filterOpts(mocha.parseOptsFile(confMochaOptsFilePath), !!fileName);
            return [...opts, ...(fileName ? [fileName] : []), '--opts', path.join(this.context.extensionPath, 'bin', 'empty.mocha.opts')];
        }

        const localMochaOptsFilePath = path.join(vscode.workspace.rootPath, 'test', 'mocha.opts');
        if (fs.existsSync(localMochaOptsFilePath)) {
            const opts = mocha.filterOpts(mocha.parseOptsFile(localMochaOptsFilePath), !!fileName);
            return [...opts, ...(fileName ? [fileName] : []), '--opts', path.join(this.context.extensionPath, 'bin', 'empty.mocha.opts')];
        }

        return [];
    }

    async mochaReporterArguments(): Promise<string[]> {
        return ['--reporter', path.join(this.context.extensionPath, 'bin', 'reporter.js')];
    }

    async mochaFilesArgument(): Promise<string[]> {
        return []
    }
}

/*
function treeToMap(tree, map = {}) {
    map[tree.id] = tree;
    tree.tests && tree.tests.forEach((test) => treeToMap(test, map));
    tree.suites && tree.suites.forEach((suite) => treeToMap(suite, map));
    return map;
}*/