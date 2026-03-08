/**
 * Tests for Auth Manager
 * 
 * Tests API key validation and storage.
 */

import { AuthManager } from '../src/auth';
import * as vscode from 'vscode';

describe('AuthManager', () => {
    let authManager: AuthManager;
    let mockContext: any;
    let mockSecrets: {
        get: jest.Mock;
        store: jest.Mock;
        delete: jest.Mock;
    };

    beforeEach(() => {
        mockSecrets = {
            get: jest.fn(),
            store: jest.fn(),
            delete: jest.fn(),
        };

        mockContext = {
            secrets: mockSecrets,
            subscriptions: [],
        };

        authManager = new AuthManager(mockContext);
    });

    describe('getApiKey', () => {
        it('should return stored API key', async () => {
            mockSecrets.get.mockResolvedValueOnce('cs_test_key_123');

            const key = await authManager.getApiKey();

            expect(key).toBe('cs_test_key_123');
            expect(mockSecrets.get).toHaveBeenCalledWith('createstate.apiKey');
        });

        it('should return undefined when no key stored', async () => {
            mockSecrets.get.mockResolvedValueOnce(undefined);

            const key = await authManager.getApiKey();

            expect(key).toBeUndefined();
        });

        it('should cache API key after first retrieval', async () => {
            mockSecrets.get.mockResolvedValueOnce('cs_cached_key');

            await authManager.getApiKey();
            await authManager.getApiKey();

            // Should only call secrets.get once due to caching
            expect(mockSecrets.get).toHaveBeenCalledTimes(1);
        });

        it('should handle storage errors gracefully', async () => {
            mockSecrets.get.mockRejectedValueOnce(new Error('Storage error'));

            const key = await authManager.getApiKey();

            expect(key).toBeUndefined();
        });
    });

    describe('setApiKey', () => {
        it('should store API key in secrets', async () => {
            await authManager.setApiKey('cs_new_key_456');

            expect(mockSecrets.store).toHaveBeenCalledWith(
                'createstate.apiKey',
                'cs_new_key_456'
            );
        });

        it('should update cache after storing', async () => {
            await authManager.setApiKey('cs_new_key');

            // After setting, getApiKey should return cached value without calling secrets.get
            const key = await authManager.getApiKey();

            expect(key).toBe('cs_new_key');
            expect(mockSecrets.get).not.toHaveBeenCalled();
        });

        it('should throw on storage failure', async () => {
            mockSecrets.store.mockRejectedValueOnce(new Error('Storage failed'));

            await expect(authManager.setApiKey('cs_test'))
                .rejects.toThrow('Failed to securely store API key');
        });
    });

    describe('clearApiKey', () => {
        it('should delete API key from secrets', async () => {
            await authManager.clearApiKey();

            expect(mockSecrets.delete).toHaveBeenCalledWith('createstate.apiKey');
        });

        it('should clear cache', async () => {
            // First set a key (populates cache)
            await authManager.setApiKey('cs_to_clear');
            
            // Clear it
            await authManager.clearApiKey();

            // Now getApiKey should call secrets.get again (cache cleared)
            mockSecrets.get.mockResolvedValueOnce(undefined);
            const key = await authManager.getApiKey();

            expect(key).toBeUndefined();
            expect(mockSecrets.get).toHaveBeenCalled();
        });
    });

    describe('hasApiKey', () => {
        it('should return true when key exists', async () => {
            mockSecrets.get.mockResolvedValueOnce('cs_exists');

            const hasKey = await authManager.hasApiKey();

            expect(hasKey).toBe(true);
        });

        it('should return false when no key', async () => {
            mockSecrets.get.mockResolvedValueOnce(undefined);

            const hasKey = await authManager.hasApiKey();

            expect(hasKey).toBe(false);
        });

        it('should return false for empty string', async () => {
            mockSecrets.get.mockResolvedValueOnce('');

            const hasKey = await authManager.hasApiKey();

            expect(hasKey).toBe(false);
        });
    });
});

describe('API Key Validation', () => {
    /**
     * Tests for the validation logic used in promptForApiKey
     */

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

    it('should reject empty input', () => {
        expect(validateApiKey('')).toBe('API key cannot be empty');
        expect(validateApiKey('   ')).toBe('API key cannot be empty');
    });

    it('should reject keys without cs_ prefix', () => {
        expect(validateApiKey('api_key_12345678901234567890'))
            .toBe('API key should start with "cs_"');
        expect(validateApiKey('sk_12345678901234567890'))
            .toBe('API key should start with "cs_"');
    });

    it('should reject short keys', () => {
        expect(validateApiKey('cs_short'))
            .toBe('API key seems too short');
        expect(validateApiKey('cs_123'))
            .toBe('API key seems too short');
    });

    it('should accept valid keys', () => {
        expect(validateApiKey('cs_12345678901234567890')).toBeNull();
        expect(validateApiKey('cs_abcdefghijklmnopqrstuvwxyz')).toBeNull();
    });

    it('should accept keys with various characters', () => {
        expect(validateApiKey('cs_AbC123_XyZ-789!@#')).toBeNull();
    });
});
