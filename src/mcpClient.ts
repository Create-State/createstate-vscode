import * as vscode from 'vscode';
import { AuthManager } from './auth';

interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
    id: number;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: number;
}

interface McpToolResult {
    content?: Array<{ type: string; text: string }>;
    [key: string]: unknown;
}

export interface WorldModel {
    id: string;
    name: string;
    project_path: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface CodeCapture {
    code: string;
    language: string;
    file_path: string;
    description: string;
    change_type: 'new' | 'update' | 'fix' | 'refactor';
}

export interface ContextCapture {
    context: string;
}

export interface SearchResult {
    content: string;
    similarity: number;
    metadata: Record<string, unknown>;
}

export interface SessionHandoff {
    handoff_id: string;
    created_at: string;
    ai_model?: string;
    summary?: string;
}

export class McpClient {
    private requestId = 0;
    private authManager: AuthManager;

    constructor(authManager: AuthManager) {
        this.authManager = authManager;
    }

    private getServerUrl(): string {
        const config = vscode.workspace.getConfiguration('createstate');
        const url = config.get<string>('serverUrl') || 'https://createstate.ai';
        
        // Validate URL format and security
        this.validateServerUrl(url);
        
        return url;
    }

    private validateServerUrl(url: string): void {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new Error(`Invalid server URL: ${url}`);
        }

        // Allow localhost for development, require HTTPS for everything else
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (!isLocalhost && parsed.protocol !== 'https:') {
            throw new Error('Server URL must use HTTPS for security');
        }
    }

    private async makeRawRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
        const apiKey = await this.authManager.getApiKey();
        if (!apiKey) {
            throw new Error('API key not configured. Run "Create State: Set API Key" first.');
        }

        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id: ++this.requestId,
        };

        const serverUrl = this.getServerUrl();
        const response = await fetch(`${serverUrl}/mcp/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const jsonResponse = await response.json() as JsonRpcResponse;

        if (jsonResponse.error) {
            throw new Error(`MCP Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`);
        }

        return jsonResponse.result as T;
    }

    private async callTool<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
        const result = await this.makeRawRequest<McpToolResult>('tools/call', {
            name: toolName,
            arguments: {
                ...args,
                _client_type: 'vscode',
            },
        });
        return result as T;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.makeRawRequest('initialize', {
                protocolVersion: '2024-11-05',
                clientInfo: {
                    name: 'vscode-createstate',
                    version: '0.1.0',
                },
            });
            return true;
        } catch {
            return false;
        }
    }

    async getProjectWorldModel(projectName: string): Promise<McpToolResult> {
        return this.callTool('getProjectWorldModel', {
            project_path: projectName,
            include_insights: true,
        });
    }

    async listWorldModels(): Promise<McpToolResult> {
        return this.callTool('listUserWorldModels', {
            include_archived: false,
        });
    }

    async captureCode(capture: CodeCapture): Promise<McpToolResult> {
        return this.callTool('captureCode', {
            code: capture.code,
            language: capture.language,
            file_path: capture.file_path,
            description: capture.description,
            change_type: capture.change_type,
            ai_model: 'VS Code Extension',
        });
    }

    async captureConversationContext(capture: ContextCapture): Promise<McpToolResult> {
        return this.callTool('captureConversationContext', {
            context: capture.context,
            ai_model: 'VS Code Extension',
        });
    }

    async searchProjectKnowledge(query: string, limit?: number): Promise<McpToolResult> {
        return this.callTool('searchProjectKnowledge', {
            query,
            limit: limit || 10,
        });
    }

    async listHandoffPackages(limit?: number): Promise<McpToolResult> {
        return this.callTool('listHandoffPackages', {
            max_results: limit || 5,
            include_expired: false,
        });
    }

    async restoreFromHandoff(handoffId: string): Promise<McpToolResult> {
        return this.callTool('restoreFromHandoff', {
            handoff_id: handoffId,
            priority_restoration: true,
        });
    }

    async createSessionHandoff(summary?: string): Promise<McpToolResult> {
        return this.callTool('createSessionHandoff', {
            ai_model: 'VS Code Extension',
            handoff_name: summary || '',
            include_experimental_thoughts: true,
        });
    }

    async synthesizeProjectContext(): Promise<McpToolResult> {
        return this.callTool('synthesizeProjectContext', {});
    }

    extractTextContent(result: McpToolResult): string {
        if (result.content && Array.isArray(result.content)) {
            return result.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n\n');
        }
        return JSON.stringify(result, null, 2);
    }
}
