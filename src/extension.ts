'use strict';

import * as vscode from 'vscode';
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
            vscode.window.showInformationMessage(`Running all tests in ${vscode.window.activeTextEditor.document.fileName}`);
            await mochaTestRunner.run(vscode.window.activeTextEditor.document.fileName);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.showTestPreview', (id: string) => {
        return vscode.commands.executeCommand('vscode.previewHtml', vscode.Uri.parse(`mocha-test-result://view?${id}`), vscode.ViewColumn.Two, 'Test Results Preview')
            .then((success) => {}, (reason) => vscode.window.showErrorMessage(reason));
    }));
}

export function deactivate() {
}