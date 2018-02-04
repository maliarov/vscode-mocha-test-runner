'use strict';

import * as vscode from 'vscode';
import MochaTestRunner, {MochaTestRunnerStateData, MochaTestRunnerStates} from './MochaTestRunner';
import MochaTestTreeDataProvider from './MochaTreeDataProvider';
import MochaTestDocumentContentProvider from './MochaTestDocumentContentProvider';

import Test from './models/Test';
import Tests from './models/Tests';

const progressOptions: vscode.ProgressOptions = {location: vscode.ProgressLocation.Window, title: 'preparing tests'};


export function activate(context: vscode.ExtensionContext) {
    const tests: Tests = new Tests();

    const mochaTestContentPreviewProvider: MochaTestDocumentContentProvider = new MochaTestDocumentContentProvider(context, tests);
    const mochaTestTreeDataProvider: MochaTestTreeDataProvider = new MochaTestTreeDataProvider(context, tests);

    const mochaTestRunner = new MochaTestRunner(context, tests);


    mochaTestRunner.onChangeState((stateData: MochaTestRunnerStateData) => {
        switch (stateData.state) {
            case MochaTestRunnerStates.starting:
                return showProgress();
            case MochaTestRunnerStates.fails:
                return vscode.window.showInformationMessage('Tests fails', {modal: true});
        }
    });


    vscode.window.registerTreeDataProvider('testRunner', mochaTestTreeDataProvider);
    vscode.workspace.registerTextDocumentContentProvider('mocha-test-result', mochaTestContentPreviewProvider);


    context.subscriptions.push(vscode.commands.registerCommand('extension.stopTests', async () => {
        try {
            mochaTestRunner.stop();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.runAllTests', async () => {
        try {
            await mochaTestRunner.run()
        } catch (err) {
            console.error(err);
            throw err;
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.runAllTestsInFile', async () => {
        try {
            const fileName: string = vscode.window.activeTextEditor.document.fileName;
            vscode.window.showInformationMessage(`Running all tests in ${fileName}`);
            await mochaTestRunner.run(fileName);
        } catch (err) {
            vscode.window.showErrorMessage(err);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.showTestPreview', async (id: string) => {
        try {
            const url: vscode.Uri = vscode.Uri.parse(`mocha-test-result://view?${id}`);
            await vscode.commands.executeCommand('vscode.previewHtml', url, vscode.ViewColumn.Two, 'Test Results Preview')
        } catch (err) {
            vscode.window.showErrorMessage(err);
        }
    }));


    function showProgress(): void {
        vscode.window.withProgress(progressOptions, onProgress);
    }

    async function onProgress(process: vscode.Progress<{message?: string}>): Promise<void> {
        let onChangeStateDisposer: vscode.Disposable;

        return new Promise<void>((resolve, reject) => {
            onChangeStateDisposer = mochaTestRunner.onChangeState((stateData: MochaTestRunnerStateData) => {
                switch (stateData.state) {
                    case MochaTestRunnerStates.starting:
                        return process.report({message: 'preparing tests'});

                    case MochaTestRunnerStates.start:
                        return process.report({message: 'starting tests'});

                    case MochaTestRunnerStates.startTest:
                        const test: Test = <Test>stateData.payload;
                        return process.report({message: `[test] ${test.title}`});

                    case MochaTestRunnerStates.fails:
                    case MochaTestRunnerStates.stopped:
                        resolve();
                        return;
                }
            });
        })
            .then(onDone)
            .catch(onDone);

        function onDone(): void {
            onChangeStateDisposer.dispose();
        }
    }
}

export function deactivate() {
}

