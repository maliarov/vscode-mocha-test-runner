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

import * as mocha from './utils/mocha';
import * as npm from './utils/npm';

interface Payload {
    id?: string;
    error?: object;

    dynamic?: boolean;
    parent?: string;
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
            this.childProcess.kill();
            this.childProcess = null;
        }
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.stopped});
    }

    async run(fileName?: string): Promise<void> {
        if (this.childProcess) {
            return;
        }

        this.tests.setState('root',  TestState.progress);
        this.tests.updateRoot();

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
                    this.onData(command)
                        .then(() => cb())
                        .catch((err) => cb(err));
                }));

            this.childProcess.stderr
                .setEncoding('utf-8')
                .on('data', (data) => {
                    console.error(data.toString());
                });

            this.childProcess.on('close', (code) => {
                if (!code) {
                    return resolve();
                }

                this.tests.terminate();

                this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.fails});
                if (this.childProcess) {
                    this.childProcess.kill();
                    this.childProcess = null;
                }
        
                reject();
            });
        });
    }


    onData(command: Command): Promise<any> {
        switch (command.command) {
            case 'tests::tree':
                return this.onTestsTreeCommand(command.payload);

            case 'tests::start':
                return this.onTestsStartCommand();

            case 'suite::start':
                return this.onSuiteStartCommand(command.payload);

            case 'test::start':
                return this.onTestStartCommand(command.payload);

            case 'test::success':
                return this.onTestSuccessCommand(command.payload.id);

            case 'test::fail':
                return this.onTestFailCommand(command.payload.id, command.payload.error);

            case 'test::pending':
                return this.onTestPendingCommand(command.payload.id);

            case 'test::end':
                return this.onTestEndCommand(command.payload.id);

            case 'suite::end':
                return this.onSuiteEndCommand(command.payload.id);

            case 'tests::end':
                return this.onTestsEndCommand();
        }
    }

    async onTestsTreeCommand(tree: any): Promise<void> {
        this.tests.parse(tree);
        this.tests.updateState('root');
        this.tests.updateRoot();
    }

    async onTestsStartCommand(): Promise<void> {
        this.tests.setState('root', TestState.progress);
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.start});
    }

    async onTestsEndCommand(): Promise<void> {
        this.tests.updateState('root');
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.stopped});
    }

    async onTestStartCommand(payload: Payload): Promise<void> {
        if (payload.dynamic) {
            const parent: Test = this.tests.getById(payload.parent);
            if (!(parent instanceof Suite)) {
                return;
            }
            this.tests.parse(payload, <Suite>parent);
        }

        this.tests.setState(payload.id, TestState.progress);
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.startTest, payload: this.tests.getById(payload.id)});
    }

    async onTestSuccessCommand(id: string): Promise<void> {
        this.tests.setState(id, TestState.success);
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: this.tests.getById(id)});
    }

    async onTestFailCommand(id: string, error: object): Promise<void> {
        this.tests.setState(id, TestState.fail);
        this.tests.getById(id).error = error;
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: this.tests.getById(id)});
    }

    async onTestPendingCommand(id: string): Promise<void> {
        this.tests.setState(id, TestState.pending);
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: this.tests.getById(id)});
    }

    async onTestEndCommand(id: string): Promise<void> {
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishTest, payload: this.tests.getById(id)});
    }

    async onSuiteStartCommand(payload: Payload): Promise<void> {
        if (payload.dynamic) {
            const parent: Test = this.tests.getById(payload.parent);
            if (!(parent instanceof Suite)) {
                return;
            }
            this.tests.parse(payload, <Suite>parent);
        }
        
        this.tests.setState(payload.id, TestState.progress);
        this.tests.updateRoot();
        this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.startSuite, payload: this.tests.getById(payload.id)});
    }

    async onSuiteEndCommand(id: string): Promise<void> {
        this.tests.updateState(id);
        this.tests.updateRoot();
        await this.onChangeStateEmmiter.fire({state: MochaTestRunnerStates.finishSuite, payload: this.tests.getById(id)});
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