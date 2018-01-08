'use strict';

import * as vscode from 'vscode';

export default class MochaTestDocumentContentProvider implements vscode.TextDocumentContentProvider {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public provideTextDocumentContent(uri: vscode.Uri): string {
        const map: any = this.context.workspaceState.get<any>('map');
        if (!map) {
            return 'test data not ready';
        }
        
        const node: any = map[uri.query];
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