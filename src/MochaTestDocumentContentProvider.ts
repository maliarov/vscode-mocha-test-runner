'use strict';

import * as vscode from 'vscode';

import TestState from './models/TestState';
import Test from './models/Test';
import Tests from './models/Tests';


export default class MochaTestDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private context: vscode.ExtensionContext;
    private tests: Tests;

    constructor(context: vscode.ExtensionContext, tests: Tests) {
        this.context = context;
        this.tests = tests;
    }

    public provideTextDocumentContent(uri: vscode.Uri): string {
        const test: Test = this.tests.getById(uri.query);
        if (!test) {
            return 'test not found';
        }

        switch (test.state) {
            case TestState.fail:
                const html = ((test.error && <string>(<any>test.error).message) || '').split('\n').join('<br/>') + '<br/><br/>' + JSON.stringify(test);
                return `<html><body><pre>${html}</pre></body></html>` || 'no error data';
            case TestState.pending:
                return 'test skipped';
            case TestState.success:
                return 'test successed';
            case TestState.terminated:
                return 'test terminated';
            case TestState.progress:
                return 'test is in progress';
            default:
                return '';
        }
    }
}