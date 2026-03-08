import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { AuthManager } from './auth';
import { updateStatusBar } from './extension';
import { CreateStateSidebarProvider } from './sidebarProvider';

export function registerCommands(
    context: vscode.ExtensionContext,
    mcpClient: McpClient,
    authManager: AuthManager,
    statusBarItem: vscode.StatusBarItem,
    sidebarProvider: CreateStateSidebarProvider
): void {
    
    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.setApiKey', async () => {
            const apiKey = await authManager.promptForApiKey();
            if (apiKey) {
                const connected = await mcpClient.testConnection();
                updateStatusBar(statusBarItem, connected);
                sidebarProvider.refresh();
                
                if (connected) {
                    vscode.window.showInformationMessage('Create State: API key saved and connection verified');
                } else {
                    vscode.window.showWarningMessage('Create State: API key saved but connection test failed');
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.clearApiKey', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to clear your Create State API key?',
                { modal: true },
                'Clear API Key'
            );
            
            if (confirm === 'Clear API Key') {
                await authManager.clearApiKey();
                updateStatusBar(statusBarItem, false);
                sidebarProvider.refresh();
                vscode.window.showInformationMessage('Create State: API key cleared');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.captureCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            if (selection.isEmpty) {
                vscode.window.showErrorMessage('No code selected. Select code first.');
                return;
            }

            const code = editor.document.getText(selection);
            const filePath = vscode.workspace.asRelativePath(editor.document.uri);
            const language = editor.document.languageId;

            const description = await vscode.window.showInputBox({
                prompt: 'Describe what this code does',
                placeHolder: 'e.g., Authentication middleware for API routes',
                ignoreFocusOut: true,
            });

            if (!description) {
                return;
            }

            const changeType = await vscode.window.showQuickPick(
                [
                    { label: 'new', description: 'New code/feature' },
                    { label: 'update', description: 'Enhancement to existing code' },
                    { label: 'fix', description: 'Bug fix' },
                    { label: 'refactor', description: 'Code refactoring' },
                ],
                { placeHolder: 'What type of change is this?' }
            );

            if (!changeType) {
                return;
            }

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Capturing code to knowledge graph...',
                        cancellable: false,
                    },
                    async () => {
                        await mcpClient.captureCode({
                            code,
                            language,
                            file_path: filePath,
                            description,
                            change_type: changeType.label as 'new' | 'update' | 'fix' | 'refactor',
                        });
                    }
                );
                
                vscode.window.showInformationMessage('Code captured to knowledge graph');
                sidebarProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to capture code: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.captureContext', async () => {
            const context = await vscode.window.showInputBox({
                prompt: 'Enter context to capture (decisions, insights, notes)',
                placeHolder: 'e.g., Chose Redis for session storage because...',
                ignoreFocusOut: true,
            });

            if (!context) {
                return;
            }

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Capturing context to knowledge graph...',
                        cancellable: false,
                    },
                    async () => {
                        await mcpClient.captureConversationContext({ context });
                    }
                );
                
                vscode.window.showInformationMessage('Context captured to knowledge graph');
                sidebarProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to capture context: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.searchKnowledge', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Search the knowledge graph',
                placeHolder: 'e.g., Why did we choose PostgreSQL?',
                ignoreFocusOut: true,
            });

            if (!query) {
                return;
            }

            try {
                const results = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Searching knowledge graph...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.searchProjectKnowledge(query);
                    }
                );

                const textContent = mcpClient.extractTextContent(results);
                
                if (!textContent || textContent.trim().length === 0) {
                    vscode.window.showInformationMessage('No results found');
                    return;
                }
                
                const panel = vscode.window.createWebviewPanel(
                    'createstateResults',
                    'Create State: Search Results',
                    vscode.ViewColumn.Beside,
                    { enableScripts: false }
                );

                panel.webview.html = generateResultsHtml(query, textContent);
            } catch (error) {
                vscode.window.showErrorMessage(`Search failed: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.getWorldModel', async () => {
            const config = vscode.workspace.getConfiguration('createstate');
            let projectName = config.get<string>('projectName');

            if (!projectName) {
                projectName = await vscode.window.showInputBox({
                    prompt: 'Enter project/world model name',
                    placeHolder: 'e.g., my-project',
                    ignoreFocusOut: true,
                });
            }

            if (!projectName) {
                return;
            }

            try {
                const result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Loading world model...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.getProjectWorldModel(projectName!);
                    }
                );

                const textContent = mcpClient.extractTextContent(result);
                
                // Show the world model content in a panel
                const panel = vscode.window.createWebviewPanel(
                    'createstateWorldModel',
                    `Create State: ${projectName}`,
                    vscode.ViewColumn.Beside,
                    { enableScripts: false }
                );

                panel.webview.html = generateWorldModelHtml(projectName, textContent);
                vscode.window.showInformationMessage(`World model "${projectName}" loaded`);
                sidebarProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load world model: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.startSession', async () => {
            try {
                const handoffsResult = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Loading session handoffs...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.listHandoffPackages(10);
                    }
                );

                const textContent = mcpClient.extractTextContent(handoffsResult);
                
                // Parse handoff IDs from the response text
                const handoffMatches = textContent.matchAll(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi);
                const handoffIds = [...handoffMatches].map(m => m[1]);

                if (handoffIds.length === 0) {
                    vscode.window.showInformationMessage('No session handoffs found');
                    return;
                }

                // Create quick pick items from parsed content
                const items = handoffIds.map((id, index) => ({
                    label: `Handoff ${index + 1}: ${id.substring(0, 8)}...`,
                    description: 'Click to restore',
                    handoffId: id,
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a session handoff to restore',
                });

                if (!selected) {
                    return;
                }

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Restoring session...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.restoreFromHandoff(selected.handoffId);
                    }
                );

                vscode.window.showInformationMessage(`Session restored: ${selected.handoffId.substring(0, 8)}...`);
                sidebarProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restore session: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.endSession', async () => {
            const summary = await vscode.window.showInputBox({
                prompt: 'Enter session summary (optional)',
                placeHolder: 'e.g., Implemented user authentication',
                ignoreFocusOut: true,
            });

            try {
                const result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Creating session handoff...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.createSessionHandoff(summary || undefined);
                    }
                );

                const textContent = mcpClient.extractTextContent(result);
                
                // Extract handoff ID from response
                const idMatch = textContent.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                const displayId = idMatch ? idMatch[1].substring(0, 8) : 'created';

                vscode.window.showInformationMessage(`Session handoff created: ${displayId}...`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create handoff: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.quickRestore', async () => {
            try {
                const handoffs = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Finding latest handoff...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.listHandoffPackages(1);
                    }
                );

                const textContent = mcpClient.extractTextContent(handoffs);
                
                // Parse handoff ID from response
                const handoffMatch = textContent.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                
                if (!handoffMatch) {
                    vscode.window.showWarningMessage('No recent handoffs found. Start fresh or create one when done.');
                    return;
                }

                const handoffId = handoffMatch[1];

                const result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Restoring latest session...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.restoreFromHandoff(handoffId);
                    }
                );

                mcpClient.extractTextContent(result);
                vscode.window.showInformationMessage(`Session restored: ${handoffId.substring(0, 8)}...`);
                sidebarProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to restore: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.synthesize', async () => {
            try {
                const result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Synthesizing project context...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.synthesizeProjectContext();
                    }
                );

                const textContent = mcpClient.extractTextContent(result);
                
                const panel = vscode.window.createWebviewPanel(
                    'createstateSynthesis',
                    'Create State: Project Context',
                    vscode.ViewColumn.Beside,
                    { enableScripts: false }
                );

                panel.webview.html = generateSynthesisHtml(textContent);
                vscode.window.showInformationMessage('Project context synthesized');
            } catch (error) {
                vscode.window.showErrorMessage(`Synthesis failed: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.listModels', async () => {
            try {
                const result = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Loading world models...',
                        cancellable: false,
                    },
                    async () => {
                        return mcpClient.listWorldModels();
                    }
                );

                const textContent = mcpClient.extractTextContent(result);
                
                const panel = vscode.window.createWebviewPanel(
                    'createstateModels',
                    'Create State: World Models',
                    vscode.ViewColumn.Beside,
                    { enableScripts: false }
                );

                panel.webview.html = generateModelsHtml(textContent);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to list models: ${error}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('createstate.showStatus', async () => {
            const hasKey = await authManager.hasApiKey();
            
            if (!hasKey) {
                const action = await vscode.window.showWarningMessage(
                    'Create State: Not connected (no API key)',
                    'Set API Key'
                );
                if (action === 'Set API Key') {
                    vscode.commands.executeCommand('createstate.setApiKey');
                }
                return;
            }

            const connected = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Testing connection...',
                    cancellable: false,
                },
                async () => {
                    return mcpClient.testConnection();
                }
            );

            updateStatusBar(statusBarItem, connected);

            if (connected) {
                vscode.window.showInformationMessage('Create State: Connected');
            } else {
                vscode.window.showErrorMessage('Create State: Connection failed');
            }
        })
    );
}

function generateResultsHtml(query: string, content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search Results</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h2 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .query {
            background: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .result {
            margin-bottom: 20px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }
        .result-header {
            background: var(--vscode-sideBar-background);
            padding: 8px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .result-number {
            font-weight: bold;
        }
        .similarity {
            color: var(--vscode-textLink-foreground);
        }
        .content {
            padding: 12px;
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            background: var(--vscode-editor-background);
        }
    </style>
</head>
<body>
    <h2>Knowledge Graph Search Results</h2>
    <div class="query"><strong>Query:</strong> ${escapeHtml(query)}</div>
    <div class="results">
        <pre class="content">${escapeHtml(content)}</pre>
    </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateSynthesisHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Context</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 16px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .synthesis-content {
            max-width: 800px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="synthesis-content">
        <h1>Project Context Synthesis</h1>
        <pre>${escapeHtml(content)}</pre>
    </div>
</body>
</html>`;
}

function generateModelsHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>World Models</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            line-height: 1.6;
        }
        h1, h2 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 16px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    <h1>Your World Models</h1>
    <pre>${escapeHtml(content)}</pre>
</body>
</html>`;
}

function generateWorldModelHtml(projectName: string, content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(projectName)} - World Model</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: var(--vscode-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        pre {
            background: var(--vscode-textBlockQuote-background);
            padding: 16px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .world-model-content {
            max-width: 900px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div class="world-model-content">
        <h1>World Model: ${escapeHtml(projectName)}</h1>
        <pre>${escapeHtml(content)}</pre>
    </div>
</body>
</html>`;
}
