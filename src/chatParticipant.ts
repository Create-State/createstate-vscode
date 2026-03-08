import * as vscode from 'vscode';
import { McpClient } from './mcpClient';
import { AuthManager } from './auth';

const PARTICIPANT_ID = 'createstate.chat';

interface ChatCommand {
    name: string;
    description: string;
    handler: (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ) => Promise<void>;
}

export class CreateStateChatParticipant {
    private mcpClient: McpClient;
    private authManager: AuthManager;
    private participant: vscode.ChatParticipant;
    private commands: Map<string, ChatCommand>;

    constructor(
        context: vscode.ExtensionContext,
        mcpClient: McpClient,
        authManager: AuthManager
    ) {
        this.mcpClient = mcpClient;
        this.authManager = authManager;
        this.commands = new Map();

        // Register commands
        this.registerCommands();

        // Create the chat participant
        this.participant = vscode.chat.createChatParticipant(
            PARTICIPANT_ID,
            this.handleRequest.bind(this)
        );

        this.participant.iconPath = new vscode.ThemeIcon('database');
        this.participant.followupProvider = {
            provideFollowups: this.provideFollowups.bind(this),
        };

        context.subscriptions.push(this.participant);
    }

    private registerCommands(): void {
        this.commands.set('search', {
            name: 'search',
            description: 'Search the knowledge graph for decisions, insights, and context',
            handler: this.handleSearch.bind(this),
        });

        this.commands.set('restore', {
            name: 'restore',
            description: 'Restore from the most recent session handoff',
            handler: this.handleRestore.bind(this),
        });

        this.commands.set('handoff', {
            name: 'handoff',
            description: 'Create a session handoff to preserve current context',
            handler: this.handleHandoff.bind(this),
        });

        this.commands.set('synthesize', {
            name: 'synthesize',
            description: 'Synthesize all captured knowledge into a project summary',
            handler: this.handleSynthesize.bind(this),
        });

        this.commands.set('capture', {
            name: 'capture',
            description: 'Capture context, decisions, or insights to the knowledge graph',
            handler: this.handleCaptureContext.bind(this),
        });

        this.commands.set('code', {
            name: 'code',
            description: 'Capture the currently selected code to the knowledge graph',
            handler: this.handleCaptureCode.bind(this),
        });

        this.commands.set('context', {
            name: 'context',
            description: 'Get the current project world model context',
            handler: this.handleGetContext.bind(this),
        });

        this.commands.set('models', {
            name: 'models',
            description: 'List all your world models',
            handler: this.handleListModels.bind(this),
        });

        this.commands.set('help', {
            name: 'help',
            description: 'Show available commands',
            handler: this.handleHelp.bind(this),
        });
    }

    private async handleRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> {
        // Check authentication first
        const hasApiKey = await this.authManager.hasApiKey();
        if (!hasApiKey) {
            stream.markdown('**Not connected to Create State**\n\n');
            stream.markdown('Please set your API key first:\n');
            stream.markdown('1. Open Command Palette (`Cmd+Shift+P`)\n');
            stream.markdown('2. Run `Create State: Set API Key`\n');
            stream.button({
                command: 'createstate.setApiKey',
                title: 'Set API Key',
            });
            return { metadata: { command: 'auth_required' } };
        }

        const command = request.command;
        const prompt = request.prompt.trim();

        // Handle explicit commands
        if (command && this.commands.has(command)) {
            const cmd = this.commands.get(command)!;
            await cmd.handler(request, context, stream, token);
            return { metadata: { command } };
        }

        // Natural language routing - infer intent from prompt
        const intent = this.inferIntent(prompt);
        
        if (intent.command && this.commands.has(intent.command)) {
            const cmd = this.commands.get(intent.command)!;
            // Modify request to include the extracted query
            const modifiedRequest = {
                ...request,
                prompt: intent.query || prompt,
            } as vscode.ChatRequest;
            await cmd.handler(modifiedRequest, context, stream, token);
            return { metadata: { command: intent.command, inferred: true } };
        }

        // Default: treat as a search query
        await this.handleSearch(request, context, stream, token);
        return { metadata: { command: 'search', inferred: true } };
    }

    private inferIntent(prompt: string): { command: string | null; query: string } {
        const lower = prompt.toLowerCase();

        // Restore/session patterns
        if (lower.match(/^(restore|resume|continue|pick up|load session|start session)/)) {
            return { command: 'restore', query: '' };
        }

        // Capture code patterns - must check BEFORE handoff (to catch "save code")
        if (lower.match(/^(capture code|save code|record code|capture selected|capture this code)/)) {
            const match = prompt.match(/(?:capture|save|record)\s*(?:code|selected|this code)\s*[:-]?\s*(.*)/i);
            return { command: 'code', query: match?.[1] || '' };
        }

        // Handoff/save patterns - after capture code check
        if (lower.match(/^(handoff|save session|save\s*:|save$|end session|create handoff|preserve|checkpoint)/)) {
            const match = prompt.match(/(?:handoff|save|checkpoint)\s*[:-]?\s*(.*)/i);
            return { command: 'handoff', query: match?.[1] || '' };
        }

        // Synthesize patterns
        if (lower.match(/^(synthesize|summarize|generate summary|project summary|context summary)/)) {
            return { command: 'synthesize', query: '' };
        }

        // Capture context/decision patterns
        if (lower.match(/^(capture|record|remember|note|decision|decided|chose|choosing)/)) {
            const match = prompt.match(/(?:capture|record|remember|note|decision|decided|chose)\s*[:-]?\s*(.*)/i);
            return { command: 'capture', query: match?.[1] || prompt };
        }

        // List models patterns
        if (lower.match(/^(list|show)\s*(my\s*)?(world\s*)?models?|^my\s*(world\s*)?models?/)) {
            return { command: 'models', query: '' };
        }

        // Get context patterns
        if (lower.match(/^(get|show|load|what('?s| is))\s*(the\s*)?(project\s*)?(context|world model)/)) {
            return { command: 'context', query: '' };
        }

        // Help patterns
        if (lower.match(/^(help|commands|what can you|how do i|usage)/)) {
            return { command: 'help', query: '' };
        }

        // Search patterns (explicit)
        if (lower.match(/^(search|find|look for|query|what|why|how|where|when)/)) {
            const match = prompt.match(/(?:search|find|look for|query)\s*(?:for)?\s*[:-]?\s*(.*)/i);
            return { command: 'search', query: match?.[1] || prompt };
        }

        // Default to search with full prompt
        return { command: 'search', query: prompt };
    }

    private async handleSearch(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const query = request.prompt.trim();
        
        if (!query) {
            stream.markdown('**What would you like to search for?**\n\n');
            stream.markdown('Try asking about:\n');
            stream.markdown('- Architectural decisions\n');
            stream.markdown('- Why something was implemented a certain way\n');
            stream.markdown('- Known issues or bugs\n');
            stream.markdown('- Code patterns and conventions\n');
            return;
        }

        stream.progress('Searching knowledge graph...');

        try {
            const result = await this.mcpClient.searchProjectKnowledge(query, 10);
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Search Results: "${query}"\n\n`);
            stream.markdown(content || '*No results found*');
        } catch (error) {
            stream.markdown(`**Search failed:** ${error}\n`);
        }
    }

    private async handleRestore(
        _request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        stream.progress('Finding latest handoff...');

        try {
            const handoffs = await this.mcpClient.listHandoffPackages(1);
            const textContent = this.mcpClient.extractTextContent(handoffs);
            
            const handoffMatch = textContent.match(
                /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            );

            if (!handoffMatch) {
                stream.markdown('**No recent handoffs found**\n\n');
                stream.markdown('Start fresh and create a handoff when you\'re done to preserve your session.\n');
                return;
            }

            const handoffId = handoffMatch[1];
            stream.progress('Restoring session...');

            const result = await this.mcpClient.restoreFromHandoff(handoffId);
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Session Restored\n\n`);
            stream.markdown(`**Handoff ID:** \`${handoffId.substring(0, 8)}...\`\n\n`);
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Restore failed:** ${error}\n`);
        }
    }

    private async handleHandoff(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const summary = request.prompt.trim() || undefined;
        
        stream.progress('Creating session handoff...');

        try {
            const result = await this.mcpClient.createSessionHandoff(summary);
            const content = this.mcpClient.extractTextContent(result);

            const idMatch = content.match(
                /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            );

            stream.markdown(`## Session Handoff Created\n\n`);
            if (idMatch) {
                stream.markdown(`**Handoff ID:** \`${idMatch[1].substring(0, 8)}...\`\n\n`);
            }
            if (summary) {
                stream.markdown(`**Summary:** ${summary}\n\n`);
            }
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Handoff creation failed:** ${error}\n`);
        }
    }

    private async handleSynthesize(
        _request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        stream.progress('Synthesizing project context...');

        try {
            const result = await this.mcpClient.synthesizeProjectContext();
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Project Context Synthesis\n\n`);
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Synthesis failed:** ${error}\n`);
        }
    }

    private async handleCaptureContext(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const contextText = request.prompt.trim();

        if (!contextText) {
            stream.markdown('**What would you like to capture?**\n\n');
            stream.markdown('Examples:\n');
            stream.markdown('- `@createstate capture Decided to use Redis for session storage because of its TTL support`\n');
            stream.markdown('- `@createstate capture The auth bug was caused by stale JWT tokens not being invalidated`\n');
            stream.markdown('- `@createstate note We chose PostgreSQL over MongoDB for ACID compliance`\n');
            return;
        }

        stream.progress('Capturing to knowledge graph...');

        try {
            const result = await this.mcpClient.captureConversationContext({ context: contextText });
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Context Captured\n\n`);
            stream.markdown(`> ${contextText}\n\n`);
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Capture failed:** ${error}\n`);
        }
    }

    private async handleCaptureCode(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            stream.markdown('**No active editor**\n\n');
            stream.markdown('Open a file and select code to capture.\n');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            stream.markdown('**No code selected**\n\n');
            stream.markdown('Select the code you want to capture, then try again.\n');
            return;
        }

        const code = editor.document.getText(selection);
        const filePath = vscode.workspace.asRelativePath(editor.document.uri);
        const language = editor.document.languageId;
        const description = request.prompt.trim() || 'Captured from VS Code';

        stream.progress('Capturing code to knowledge graph...');

        try {
            const result = await this.mcpClient.captureCode({
                code,
                language,
                file_path: filePath,
                description,
                change_type: 'update',
            });
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Code Captured\n\n`);
            stream.markdown(`**File:** \`${filePath}\`\n`);
            stream.markdown(`**Language:** ${language}\n`);
            stream.markdown(`**Lines:** ${selection.start.line + 1}-${selection.end.line + 1}\n\n`);
            if (description !== 'Captured from VS Code') {
                stream.markdown(`**Description:** ${description}\n\n`);
            }
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Capture failed:** ${error}\n`);
        }
    }

    private async handleGetContext(
        _request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('createstate');
        const projectName = config.get<string>('projectName') || 
            vscode.workspace.name || 
            'default';

        stream.progress('Loading world model...');

        try {
            const result = await this.mcpClient.getProjectWorldModel(projectName);
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Project Context: ${projectName}\n\n`);
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Failed to load context:** ${error}\n`);
        }
    }

    private async handleListModels(
        _request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        stream.progress('Loading world models...');

        try {
            const result = await this.mcpClient.listWorldModels();
            const content = this.mcpClient.extractTextContent(result);

            stream.markdown(`## Your World Models\n\n`);
            stream.markdown(content);
        } catch (error) {
            stream.markdown(`**Failed to list models:** ${error}\n`);
        }
    }

    private async handleHelp(
        _request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        _token: vscode.CancellationToken
    ): Promise<void> {
        stream.markdown(`## Create State Commands\n\n`);
        stream.markdown(`Use \`@createstate\` followed by a command or natural language:\n\n`);
        
        stream.markdown(`### Session Management\n`);
        stream.markdown(`- \`/restore\` - Restore from latest session handoff\n`);
        stream.markdown(`- \`/handoff [summary]\` - Create a session handoff\n\n`);
        
        stream.markdown(`### Knowledge Graph\n`);
        stream.markdown(`- \`/search <query>\` - Search captured knowledge\n`);
        stream.markdown(`- \`/synthesize\` - Generate project summary\n`);
        stream.markdown(`- \`/context\` - Get current project context\n\n`);
        
        stream.markdown(`### Capture\n`);
        stream.markdown(`- \`/capture <text>\` - Capture context/decisions\n`);
        stream.markdown(`- \`/code [description]\` - Capture selected code\n\n`);
        
        stream.markdown(`### Other\n`);
        stream.markdown(`- \`/models\` - List your world models\n`);
        stream.markdown(`- \`/help\` - Show this help\n\n`);
        
        stream.markdown(`### Natural Language\n`);
        stream.markdown(`You can also just ask naturally:\n`);
        stream.markdown(`- "What decisions have we made about auth?"\n`);
        stream.markdown(`- "Remember that we chose Postgres for ACID compliance"\n`);
        stream.markdown(`- "Save this session"\n`);
        stream.markdown(`- "Continue from where I left off"\n`);
    }

    private provideFollowups(
        result: vscode.ChatResult,
        _context: vscode.ChatContext,
        _token: vscode.CancellationToken
    ): vscode.ChatFollowup[] {
        const command = result.metadata?.command as string;
        const followups: vscode.ChatFollowup[] = [];

        switch (command) {
            case 'restore':
                followups.push({
                    prompt: 'What are the current priorities?',
                    label: 'Show priorities',
                    command: 'search',
                });
                followups.push({
                    prompt: '',
                    label: 'Synthesize full context',
                    command: 'synthesize',
                });
                break;

            case 'search':
                followups.push({
                    prompt: '',
                    label: 'Get full project context',
                    command: 'context',
                });
                break;

            case 'handoff':
                followups.push({
                    prompt: '',
                    label: 'List all handoffs',
                    command: 'restore',
                });
                break;

            case 'capture':
            case 'code':
                followups.push({
                    prompt: '',
                    label: 'Create handoff to save progress',
                    command: 'handoff',
                });
                break;

            default:
                followups.push({
                    prompt: '',
                    label: 'See all commands',
                    command: 'help',
                });
        }

        return followups;
    }
}

export function registerChatParticipant(
    context: vscode.ExtensionContext,
    mcpClient: McpClient,
    authManager: AuthManager
): CreateStateChatParticipant {
    return new CreateStateChatParticipant(context, mcpClient, authManager);
}
