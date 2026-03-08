import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { AuthManager } from './auth';

export class CreateStateSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'createstate-status';

    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _mcpClient: McpClient;
    private _authManager: AuthManager;

    constructor(
        extensionUri: vscode.Uri,
        mcpClient: McpClient,
        authManager: AuthManager
    ) {
        this._extensionUri = extensionUri;
        this._mcpClient = mcpClient;
        this._authManager = authManager;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getLoadingHtml();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'setApiKey':
                    vscode.commands.executeCommand('createstate.setApiKey');
                    break;
                case 'captureCode':
                    vscode.commands.executeCommand('createstate.captureCode');
                    break;
                case 'captureContext':
                    vscode.commands.executeCommand('createstate.captureContext');
                    break;
                case 'search':
                    vscode.commands.executeCommand('createstate.searchKnowledge');
                    break;
                case 'startSession':
                    vscode.commands.executeCommand('createstate.startSession');
                    break;
                case 'endSession':
                    vscode.commands.executeCommand('createstate.endSession');
                    break;
                case 'quickRestore':
                    vscode.commands.executeCommand('createstate.quickRestore');
                    break;
                case 'synthesize':
                    vscode.commands.executeCommand('createstate.synthesize');
                    break;
                case 'listModels':
                    vscode.commands.executeCommand('createstate.listModels');
                    break;
                case 'getWorldModel':
                    vscode.commands.executeCommand('createstate.getWorldModel');
                    break;
                case 'refresh':
                    this.refresh();
                    break;
            }
        });

        this._updateContent();
    }

    public refresh(): void {
        if (this._view) {
            this._updateContent();
        }
    }

    private async _updateContent(): Promise<void> {
        if (!this._view) {
            return;
        }

        const hasApiKey = await this._authManager.hasApiKey();
        
        if (!hasApiKey) {
            this._view.webview.html = this._getNoApiKeyHtml();
            return;
        }

        const connected = await this._mcpClient.testConnection();
        
        if (!connected) {
            this._view.webview.html = this._getDisconnectedHtml();
            return;
        }

        this._view.webview.html = this._getConnectedHtml();
    }

    private _getLoadingHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>${this._getStyles()}</style>
</head>
<body>
    <div class="container">
        <div class="status loading">Loading...</div>
    </div>
</body>
</html>`;
    }

    private _getNoApiKeyHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>${this._getStyles()}</style>
</head>
<body>
    <div class="container">
        <div class="status disconnected">
            <span class="icon">!</span>
            Not Connected
        </div>
        <p class="message">No API key configured</p>
        <button class="btn primary" onclick="setApiKey()">Set API Key</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function setApiKey() { vscode.postMessage({ command: 'setApiKey' }); }
    </script>
</body>
</html>`;
    }

    private _getDisconnectedHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>${this._getStyles()}</style>
</head>
<body>
    <div class="container">
        <div class="status disconnected">
            <span class="icon">!</span>
            Connection Failed
        </div>
        <p class="message">Unable to connect to Create State server</p>
        <button class="btn secondary" onclick="refresh()">Retry</button>
        <button class="btn secondary" onclick="setApiKey()">Update API Key</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function setApiKey() { vscode.postMessage({ command: 'setApiKey' }); }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
    </script>
</body>
</html>`;
    }

    private _getConnectedHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>${this._getStyles()}</style>
</head>
<body>
    <div class="container">
        <div class="status connected">
            <span class="icon">*</span>
            Connected
        </div>

        <div class="section">
            <h3>Session</h3>
            <div class="btn-group">
                <button class="btn primary full-width" onclick="restoreSession()">
                    Restore from Handoff
                </button>
                <button class="btn primary full-width" onclick="createHandoff()">
                    Create Handoff
                </button>
            </div>
            <button class="btn accent full-width" onclick="quickRestore()">
                Quick Restore (Latest)
            </button>
        </div>

        <div class="section">
            <h3>Knowledge Graph</h3>
            <button class="btn primary full-width" onclick="search()">
                Search Knowledge
            </button>
            <button class="btn secondary full-width" onclick="synthesize()">
                Synthesize Context
            </button>
        </div>
        
        <div class="section">
            <h3>Capture</h3>
            <button class="btn secondary full-width" onclick="captureCode()">
                Capture Selected Code
            </button>
            <button class="btn secondary full-width" onclick="captureContext()">
                Capture Context
            </button>
        </div>

        <div class="section collapsed">
            <h3 class="collapsible" onclick="toggleSection(this)">More Actions</h3>
            <div class="section-content">
                <button class="btn secondary full-width" onclick="listModels()">
                    List World Models
                </button>
                <button class="btn secondary full-width" onclick="getWorldModel()">
                    Load World Model
                </button>
            </div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function captureCode() { vscode.postMessage({ command: 'captureCode' }); }
        function captureContext() { vscode.postMessage({ command: 'captureContext' }); }
        function search() { vscode.postMessage({ command: 'search' }); }
        function restoreSession() { vscode.postMessage({ command: 'startSession' }); }
        function createHandoff() { vscode.postMessage({ command: 'endSession' }); }
        function quickRestore() { vscode.postMessage({ command: 'quickRestore' }); }
        function synthesize() { vscode.postMessage({ command: 'synthesize' }); }
        function listModels() { vscode.postMessage({ command: 'listModels' }); }
        function getWorldModel() { vscode.postMessage({ command: 'getWorldModel' }); }
        function toggleSection(el) {
            el.parentElement.classList.toggle('collapsed');
        }
    </script>
</body>
</html>`;
    }

    private _getStyles(): string {
        return `
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background: var(--vscode-sideBar-background);
                padding: 0;
                margin: 0;
            }
            .container {
                padding: 12px;
            }
            .status {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 4px;
                font-weight: 500;
                margin-bottom: 12px;
            }
            .status.connected {
                background: var(--vscode-testing-iconPassed);
                color: var(--vscode-editor-background);
            }
            .status.disconnected {
                background: var(--vscode-inputValidation-warningBackground);
                border: 1px solid var(--vscode-inputValidation-warningBorder);
            }
            .status.loading {
                background: var(--vscode-textBlockQuote-background);
            }
            .icon {
                font-weight: bold;
            }
            .message {
                color: var(--vscode-descriptionForeground);
                font-size: 12px;
                margin: 8px 0;
            }
            .section {
                margin-top: 16px;
            }
            .section h3 {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--vscode-sideBarSectionHeader-foreground);
                margin: 0 0 8px 0;
            }
            .section.collapsed .section-content {
                display: none;
            }
            .section h3.collapsible {
                cursor: pointer;
                user-select: none;
            }
            .section h3.collapsible:hover {
                color: var(--vscode-foreground);
            }
            .section h3.collapsible::before {
                content: '>';
                display: inline-block;
                margin-right: 4px;
                transition: transform 0.2s;
            }
            .section.collapsed h3.collapsible::before {
                transform: rotate(0deg);
            }
            .section:not(.collapsed) h3.collapsible::before {
                transform: rotate(90deg);
            }
            .btn-group {
                display: flex;
                gap: 6px;
                margin-bottom: 6px;
            }
            .btn-group .btn {
                flex: 1;
                margin-bottom: 0;
            }
            .btn {
                display: block;
                width: 100%;
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                margin-bottom: 6px;
                text-align: center;
            }
            .btn.primary {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }
            .btn.primary:hover {
                background: var(--vscode-button-hoverBackground);
            }
            .btn.secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            .btn.secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }
            .btn.accent {
                background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
                color: white;
                font-weight: 500;
            }
            .btn.accent:hover {
                background: linear-gradient(135deg, #0284c7 0%, #0891b2 100%);
            }
            .full-width {
                width: 100%;
            }
        `;
    }
}
