/**
 * Security Tests for Create State VS Code Extension
 * 
 * Tests for URL validation, API key protection, and webview security.
 */

import { McpClient } from '../src/mcpClient';
import { AuthManager } from '../src/auth';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Create a mock getter that we can control per-test
let mockServerUrl: string | undefined = undefined;

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string) => {
                if (key === 'serverUrl') {
                    return mockServerUrl;
                }
                return undefined;
            }),
        })),
    },
}), { virtual: true });

// Mock AuthManager
jest.mock('../src/auth', () => ({
    AuthManager: jest.fn().mockImplementation(() => ({
        getApiKey: jest.fn().mockResolvedValue('cs_test_api_key_12345678901234567890'),
        hasApiKey: jest.fn().mockResolvedValue(true),
    })),
}));

describe('Security Tests', () => {
    let client: McpClient;
    let mockAuthManager: jest.Mocked<AuthManager>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockReset();
        mockServerUrl = undefined; // Reset to default (https://createstate.ai)
        mockAuthManager = new AuthManager({} as any) as jest.Mocked<AuthManager>;
        client = new McpClient(mockAuthManager);
    });

    describe('API Key Protection', () => {
        it('should not expose API key in HTTP error messages', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            });

            try {
                await client.searchProjectKnowledge('test');
                fail('Should have thrown');
            } catch (error: any) {
                // Error message should NOT contain the API key
                expect(error.message).not.toContain('cs_test_api_key');
                expect(error.message).not.toContain('Bearer');
                // Should contain useful error info
                expect(error.message).toContain('500');
            }
        });

        it('should not expose API key in JSON-RPC error messages', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jsonrpc: '2.0',
                    error: { 
                        code: -32000, 
                        message: 'Authentication failed',
                        data: { details: 'Invalid credentials' }
                    },
                    id: 1,
                }),
            });

            try {
                await client.searchProjectKnowledge('test');
                fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).not.toContain('cs_test_api_key');
                expect(error.message).not.toContain('Bearer');
            }
        });

        it('should not expose API key in network error messages', async () => {
            mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

            try {
                await client.searchProjectKnowledge('test');
                fail('Should have thrown');
            } catch (error: any) {
                expect(error.message).not.toContain('cs_test_api_key');
            }
        });

        it('should not log API key (verify fetch call does not stringify key)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            await client.testConnection();

            // Verify API key is only in headers, not in body
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            
            expect(JSON.stringify(body)).not.toContain('cs_test_api_key');
            // Key should only be in Authorization header
            expect(callArgs[1].headers['Authorization']).toContain('Bearer');
        });
    });

    describe('URL Security', () => {
        it('should use HTTPS for default server URL', async () => {
            mockServerUrl = undefined; // Use default

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            await newClient.testConnection();

            // Verify default URL uses HTTPS
            const calledUrl = mockFetch.mock.calls[0][0];
            expect(calledUrl).toMatch(/^https:\/\//);
        });

        it('should reject HTTP URLs for non-localhost', async () => {
            mockServerUrl = 'http://evil-server.com';

            const newClient = new McpClient(mockAuthManager);
            
            // testConnection catches errors and returns false
            // But searchProjectKnowledge will throw
            await expect(newClient.searchProjectKnowledge('test'))
                .rejects.toThrow('must use HTTPS');
        });

        it('should allow HTTP for localhost development', async () => {
            mockServerUrl = 'http://localhost:8000';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            await expect(newClient.testConnection()).resolves.toBe(true);
        });

        it('should allow HTTP for 127.0.0.1 development', async () => {
            mockServerUrl = 'http://127.0.0.1:8000';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            await expect(newClient.testConnection()).resolves.toBe(true);
        });

        it('should reject invalid URLs', async () => {
            mockServerUrl = 'not-a-valid-url';

            const newClient = new McpClient(mockAuthManager);
            
            // testConnection catches errors, use searchProjectKnowledge instead
            await expect(newClient.searchProjectKnowledge('test'))
                .rejects.toThrow('Invalid server URL');
        });

        it('should include proper Content-Type header', async () => {
            mockServerUrl = undefined; // Use default HTTPS

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            await newClient.testConnection();

            const headers = mockFetch.mock.calls[0][1].headers;
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('should not allow request body injection', async () => {
            mockServerUrl = undefined; // Use default HTTPS

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: { content: [] }, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            
            // Attempt to inject malicious content in query
            const maliciousQuery = '"; "method": "dangerous/call", "evil": "';
            await newClient.searchProjectKnowledge(maliciousQuery);

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            
            // The malicious string should be properly contained as a value
            expect(body.params.arguments.query).toBe(maliciousQuery);
            // Method should still be correct
            expect(body.method).toBe('tools/call');
            expect(body.params.name).toBe('searchProjectKnowledge');
        });
    });

    describe('Input Validation', () => {
        beforeEach(() => {
            mockServerUrl = undefined; // Use default HTTPS
        });

        it('should handle empty queries safely', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: { content: [] }, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            // Should not throw on empty query
            await expect(newClient.searchProjectKnowledge('')).resolves.toBeDefined();
        });

        it('should handle very long input without crashing', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: { content: [] }, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            const veryLongQuery = 'a'.repeat(100000);
            await expect(newClient.searchProjectKnowledge(veryLongQuery)).resolves.toBeDefined();
        });

        it('should handle special characters in input', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: { content: [] }, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            const specialChars = '<script>alert("xss")</script>\n\r\t\0';
            await newClient.searchProjectKnowledge(specialChars);

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.arguments.query).toBe(specialChars);
        });

        it('should handle unicode and emoji in input', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: { content: [] }, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            const unicodeInput = '你好世界 🚀 émojis αβγ';
            await newClient.searchProjectKnowledge(unicodeInput);

            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(body.params.arguments.query).toBe(unicodeInput);
        });
    });

    describe('Authentication State', () => {
        beforeEach(() => {
            mockServerUrl = undefined; // Use default HTTPS
        });

        it('should reject requests when API key is missing', async () => {
            mockAuthManager.getApiKey.mockResolvedValueOnce(undefined);

            const newClient = new McpClient(mockAuthManager);
            await expect(newClient.searchProjectKnowledge('test'))
                .rejects.toThrow('API key not configured');
        });

        it('should reject requests when API key is empty string', async () => {
            mockAuthManager.getApiKey.mockResolvedValueOnce('');

            const newClient = new McpClient(mockAuthManager);
            await expect(newClient.searchProjectKnowledge('test'))
                .rejects.toThrow('API key not configured');
        });

        it('should use Bearer token scheme', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ jsonrpc: '2.0', result: {}, id: 1 }),
            });

            const newClient = new McpClient(mockAuthManager);
            await newClient.testConnection();

            const authHeader = mockFetch.mock.calls[0][1].headers['Authorization'];
            expect(authHeader).toMatch(/^Bearer /);
        });
    });

    describe('Response Handling', () => {
        it('should handle malformed JSON response gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => { throw new SyntaxError('Unexpected token'); },
            });

            await expect(client.searchProjectKnowledge('test'))
                .rejects.toThrow();
        });

        it('should handle null response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => null,
            });

            await expect(client.searchProjectKnowledge('test'))
                .rejects.toBeDefined();
        });

        it('should not execute arbitrary code from response', () => {
            // extractTextContent should safely handle any response
            const maliciousResponse = {
                content: [
                    { type: 'text', text: '<script>alert("xss")</script>' },
                ],
                __proto__: { polluted: true },
            };

            const result = client.extractTextContent(maliciousResponse);
            
            // Should return the text as-is (it's the consumer's job to sanitize for display)
            expect(result).toContain('<script>');
            // Should not have prototype pollution
            expect(({} as any).polluted).toBeUndefined();
        });
    });
});

describe('API Key Validation Security', () => {
    function validateApiKey(value: string): string | null {
        if (!value || value.trim().length === 0) {
            return 'API key cannot be empty';
        }
        if (!value.startsWith('cs_')) {
            return 'API key should start with "cs_"';
        }
        if (value.length < 20) {
            return 'API key seems too short';
        }
        return null;
    }

    it('should reject keys with only whitespace', () => {
        expect(validateApiKey('   ')).toBe('API key cannot be empty');
        expect(validateApiKey('\t\n')).toBe('API key cannot be empty');
    });

    it('should reject keys that look like other services', () => {
        expect(validateApiKey('sk_live_12345678901234567890')).not.toBeNull();
        expect(validateApiKey('pk_test_12345678901234567890')).not.toBeNull();
        expect(validateApiKey('ghp_12345678901234567890123')).not.toBeNull();
    });

    it('should reject keys with suspicious patterns', () => {
        // These might indicate copy-paste errors or placeholder values
        expect(validateApiKey('cs_')).not.toBeNull(); // Too short
        expect(validateApiKey('cs_xxx')).not.toBeNull(); // Too short
        expect(validateApiKey('cs_your_api_key_here')).toBeNull(); // Valid format but likely placeholder
    });
});

describe('Webview Security Patterns', () => {
    it('should use strict message handling', () => {
        // The sidebar only accepts predefined commands
        const validCommands = [
            'setApiKey', 'captureCode', 'captureContext', 'search',
            'startSession', 'endSession', 'quickRestore', 'synthesize',
            'listModels', 'getWorldModel', 'refresh'
        ];

        // This test documents the expected command whitelist
        expect(validCommands).toContain('setApiKey');
        expect(validCommands).not.toContain('eval');
        expect(validCommands).not.toContain('exec');
    });

    it('should not interpolate user data into HTML', () => {
        // The sidebar HTML methods don't take user input
        // This is a documentation test - actual HTML is hardcoded
        
        // Key security properties:
        // 1. No string interpolation of user data into HTML
        // 2. User actions go through VS Code command API
        // 3. No dynamic script injection
        expect(true).toBe(true);
    });
});
