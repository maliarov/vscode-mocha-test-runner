'use strict';

import * as vscode from 'vscode';
import ICommonState from './ICommonState';
import MochaTestRunner from './testRunner';
import MochaTestTreeDataProvider from './testTree';
import MochaTestDocumentContentProvider from './testDocument';



export function activate(context: vscode.ExtensionContext) {
    const state = {
        tree: null,
        map: null
    };

    const mochaTestContentPreviewProvider: MochaTestDocumentContentProvider = new MochaTestDocumentContentProvider(context, state);
    const mochaTestTreeDataProvider: MochaTestTreeDataProvider = new MochaTestTreeDataProvider(context, state);
    const mochaTestRunner = new MochaTestRunner(context, state, mochaTestTreeDataProvider);

    vscode.window.registerTreeDataProvider('testRunner', mochaTestTreeDataProvider);
    vscode.workspace.registerTextDocumentContentProvider('mocha-test-result', mochaTestContentPreviewProvider);

    context.subscriptions.push(vscode.commands.registerCommand('extension.runAllTests', async () => {
        try {
            vscode.window.showInformationMessage('Running all tests');
            await mochaTestRunner.run();
        } catch (err) {
            vscode.window.showErrorMessage(err);
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