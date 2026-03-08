/**
 * Tests for MCP Client
 * 
 * Tests JSON-RPC request formatting, response parsing, and error handling.
 * Similar to SDK client tests in tests/unit/test_sdk/
 */

import { McpClient } from '../src/mcpClient';
import { AuthManager } from '../src/auth';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock AuthManager
jest.mock('../src/auth', () => ({
    AuthManager: jest.fn().mockImplementation(() => ({
        getApiKey: jest.fn().mockResolvedValue('cs_test_api_key_12345'),
        hasApiKey: jest.fn().mockResolvedValue(true),
    })),
}));

describe('McpClient', () => {
    let client: McpClient;
    let mockAuthManager: jest.Mocked<AuthManager>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthManager = new AuthManager({} as any) as jest.Mocked<AuthManager>;
        client = new McpClient(mockAuthManager);
    });

    describe('JSON-RPC Request Formatting', () => {
        it('should format requests as JSON-RPC 2.0', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    result: { content: [{ type: 'text', text: 'test' }] },
                    id: 1,
                }),
            });

            await client.searchProjectKnowledge('test query');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/mcp/'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer cs_test_api_key_12345',
                    }),
                    body: expect.any(String),
                })
            );

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.jsonrpc).toBe('2.0');
            expect(body.method).toBe('tools/call');
            expect(body.params.name).toBe('searchProjectKnowledge');
            expect(body.id).toBeDefined();
        });

        it('should include _client_type in tool arguments', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    result: { content: [] },
                    id: 1,
                }),
            });

            await client.searchProjectKnowledge('test');

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.arguments._client_type).toBe('vscode');
        });

        it('should increment request IDs', async () => {
            const mockResponse = {
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            };
            mockFetch.mockResolvedValue(mockResponse);

            await client.searchProjectKnowledge('query1');
            await client.searchProjectKnowledge('query2');

            const body1 = JSON.parse(mockFetch.mock.calls[0][1].body);
            const body2 = JSON.parse(mockFetch.mock.calls[1][1].body);
            expect(body2.id).toBeGreaterThan(body1.id);
        });
    });

    describe('Authentication', () => {
        it('should throw error when API key not configured', async () => {
            mockAuthManager.getApiKey.mockResolvedValueOnce(undefined);

            await expect(client.searchProjectKnowledge('test'))
                .rejects.toThrow('API key not configured');
        });

        it('should use Bearer token authentication', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            await client.testConnection();

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer cs_test_api_key_12345',
                    }),
                })
            );
        });
    });

    describe('Error Handling', () => {
        it('should throw on HTTP errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: async () => 'Unauthorized',
            });

            await expect(client.searchProjectKnowledge('test'))
                .rejects.toThrow('HTTP 401');
        });

        it('should throw on JSON-RPC errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    error: { code: -32600, message: 'Invalid request' },
                    id: 1,
                }),
            });

            await expect(client.searchProjectKnowledge('test'))
                .rejects.toThrow('MCP Error -32600');
        });

        it('should handle network errors gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(client.searchProjectKnowledge('test'))
                .rejects.toThrow('Network error');
        });
    });

    describe('Tool Methods', () => {
        beforeEach(() => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    result: { content: [{ type: 'text', text: 'Success' }] },
                    id: 1,
                }),
            });
        });

        it('searchProjectKnowledge should call correct tool', async () => {
            await client.searchProjectKnowledge('auth decisions', 5);

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.name).toBe('searchProjectKnowledge');
            expect(body.params.arguments.query).toBe('auth decisions');
            expect(body.params.arguments.limit).toBe(5);
        });

        it('captureCode should include all required fields', async () => {
            await client.captureCode({
                code: 'function test() {}',
                language: 'typescript',
                file_path: 'src/test.ts',
                description: 'Test function',
                change_type: 'new',
            });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.name).toBe('captureCode');
            expect(body.params.arguments.code).toBe('function test() {}');
            expect(body.params.arguments.language).toBe('typescript');
            expect(body.params.arguments.file_path).toBe('src/test.ts');
            expect(body.params.arguments.change_type).toBe('new');
            expect(body.params.arguments.ai_model).toBe('VS Code Extension');
        });

        it('captureConversationContext should capture context', async () => {
            await client.captureConversationContext({
                context: 'Decided to use Redis for caching',
            });

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.name).toBe('captureConversationContext');
            expect(body.params.arguments.context).toBe('Decided to use Redis for caching');
        });

        it('createSessionHandoff should include optional summary', async () => {
            await client.createSessionHandoff('End of day summary');

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.name).toBe('createSessionHandoff');
            expect(body.params.arguments.handoff_name).toBe('End of day summary');
        });

        it('restoreFromHandoff should pass handoff ID', async () => {
            await client.restoreFromHandoff('abc-123-def');

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.name).toBe('restoreFromHandoff');
            expect(body.params.arguments.handoff_id).toBe('abc-123-def');
        });
    });

    describe('extractTextContent', () => {
        it('should extract text from MCP content array', () => {
            const result = {
                content: [
                    { type: 'text', text: 'First line' },
                    { type: 'text', text: 'Second line' },
                ],
            };

            const text = client.extractTextContent(result);
            expect(text).toBe('First line\n\nSecond line');
        });

        it('should return JSON for non-standard responses', () => {
            const result = { custom: 'data' };
            const text = client.extractTextContent(result);
            expect(text).toContain('custom');
        });

        it('should handle empty content', () => {
            const result = { content: [] };
            const text = client.extractTextContent(result);
            expect(text).toBe('');
        });
    });
});
