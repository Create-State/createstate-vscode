import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { AuthManager } from './auth';
import { registerCommands } from './commands';
import { CreateStateSidebarProvider } from './sidebarProvider';
import { registerChatParticipant } from './chatParticipant';

let mcpClient: McpClient | undefined;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Create State extension activating...');

    const authManager = new AuthManager(context);
    mcpClient = new McpClient(authManager);

    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = 'createstate.showStatus';
    statusBarItem.text = '$(database) Create State';
    statusBarItem.tooltip = 'Create State - Click for status';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const sidebarProvider = new CreateStateSidebarProvider(
        context.extensionUri,
        mcpClient,
        authManager
    );
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'createstate-status',
            sidebarProvider
        )
    );

    registerCommands(context, mcpClient, authManager, statusBarItem, sidebarProvider);

    // Register Copilot Chat Participant
    registerChatParticipant(context, mcpClient, authManager);

    const apiKey = await authManager.getApiKey();
    if (apiKey) {
        updateStatusBar(statusBarItem, true);
        vscode.window.showInformationMessage('Create State: Connected');
    } else {
        updateStatusBar(statusBarItem, false);
        vscode.window.showWarningMessage(
            'Create State: No API key configured. Run "Create State: Set API Key" to connect.'
        );
    }

    console.log('Create State extension activated');
}

export function deactivate(): void {
    console.log('Create State extension deactivating...');
}

export function updateStatusBar(item: vscode.StatusBarItem, connected: boolean): void {
    if (connected) {
        item.text = '$(database) Create State';
        item.backgroundColor = undefined;
    } else {
        item.text = '$(database) Create State (!)';
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
}

export function getMcpClient(): McpClient | undefined {
    return mcpClient;
}
