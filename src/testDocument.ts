'use strict';

import * as vscode from 'vscode';
import ICommonState from './ICommonState';

export default class MochaTestDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private context: vscode.ExtensionContext;
    private state: ICommonState;

    constructor(context: vscode.ExtensionContext, state: ICommonState) {
        this.context = context;
        this.state = state;
    }

    public provideTextDocumentContent(uri: vscode.Uri): string {
        if (!this.state.map) {
            return 'test data not ready';
        }
        
        const node: any = this.state.map[uri.query];
        if (!node) {
            return 'test not found';
        }

        switch (node.state) {
            case 'fail':
                const html = node.error.split('\n').join('<br/>');
                return `<html><body><pre>${html}</pre></body></html>` || 'no error data';
            case 'pending':
                return 'test skipped';
            case 'pass':
                return 'test successed';
            case 'progress':
                return 'test is in progress';
            default:
                return '';
        }
    }
}