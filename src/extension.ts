'use strict';

import * as vscode from 'vscode';
import ICommonState from './ICommonState';
import MochaTestRunner from './testRunner';
import MochaTestTreeDataProvider from './testTree';
import MochaTestDocumentContentProvider from './testDocument';

import Tests from './models/Tests';


export function activate(context: vscode.ExtensionContext) {
    const tests: Tests = new Tests();

    const mochaTestContentPreviewProvider: MochaTestDocumentContentProvider = new MochaTestDocumentContentProvider(context, tests);
    const mochaTestTreeDataProvider: MochaTestTreeDataProvider = new MochaTestTreeDataProvider(context, tests);
    const mochaTestRunner = new MochaTestRunner(context, tests);

    vscode.window.registerTreeDataProvider('testRunner', mochaTestTreeDataProvider);
    vscode.workspace.registerTextDocumentContentProvider('mocha-test-result', mochaTestContentPreviewProvider);


    //const task: Task<>: 

    context.subscriptions.push(vscode.commands.registerCommand('extension.stopTests', async () => {
        vscode.window.showInformationMessage('Stop tests');

        // progess test
        vscode.window.withProgress({location: vscode.ProgressLocation.Window, title: 'test' }, async (process: vscode.Progress<{message?: string}>) => {
            return new Promise((resolve, reject) => {

                process.report({message: '0'});

                for (let i = 1; i <= 10; i++) {
 
                    setTimeout(() => {
                        process.report({message: i.toString()});
                    }, i * 1000);
        
                }

                setTimeout(() => {
                    process.report({message: '100'});
                    resolve();
                }, 11*1000);

            });

        });
        
        try {
            mochaTestRunner.stop();
        } catch (err) {
            console.error(err);
            throw err;
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runAllTests', async () => {
        vscode.window.showInformationMessage('Running all tests');
        try {
            await mochaTestRunner.run();
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
}

export function deactivate() {
}