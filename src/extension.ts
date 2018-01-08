'use strict';

import * as vscode from 'vscode';
import MochaTestRunner from './testRunner';
import MochaTestTreeDataProvider from './testTree';
import MochaTestDocumentContentProvider from './testDocument';

export function activate(context: vscode.ExtensionContext) {
    const mochaTestContentPreviewProvider: MochaTestDocumentContentProvider = new MochaTestDocumentContentProvider(context);
    const mochaTestTreeDataProvider: MochaTestTreeDataProvider = new MochaTestTreeDataProvider(context);
    const mochaTestRunner = new MochaTestRunner(context, mochaTestTreeDataProvider);

    vscode.window.registerTreeDataProvider('testRunner', mochaTestTreeDataProvider);
    vscode.workspace.registerTextDocumentContentProvider('mocha-test-result', mochaTestContentPreviewProvider);

    context.subscriptions.push(vscode.commands.registerCommand('extension.runAllTests', async () => {
        vscode.window.showInformationMessage('Running all tests');
        await mochaTestRunner.run();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.runAllTestsInFile', async () => {
        vscode.window.showInformationMessage(`Running all tests in ${vscode.window.activeTextEditor.document.fileName}`);
        await mochaTestRunner.run(vscode.window.activeTextEditor.document.fileName);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('extension.showTestPreview', (id: string) => {
        return vscode.commands.executeCommand('vscode.previewHtml', vscode.Uri.parse(`mocha-test-result://view?${id}`), vscode.ViewColumn.Two, 'Test Results Preview')
            .then((success) => {}, (reason) => vscode.window.showErrorMessage(reason));
    }));
}

export function deactivate() {
}