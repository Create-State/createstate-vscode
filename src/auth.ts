import * as vscode from 'vscode';

const API_KEY_SECRET_KEY = 'createstate.apiKey';

export class AuthManager {
    private context: vscode.ExtensionContext;
    private cachedApiKey: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async getApiKey(): Promise<string | undefined> {
        if (this.cachedApiKey) {
            return this.cachedApiKey;
        }
        
        try {
            const apiKey = await this.context.secrets.get(API_KEY_SECRET_KEY);
            this.cachedApiKey = apiKey;
            return apiKey;
        } catch (error) {
            console.error('Failed to retrieve API key:', error);
            return undefined;
        }
    }

    async setApiKey(apiKey: string): Promise<void> {
        try {
            await this.context.secrets.store(API_KEY_SECRET_KEY, apiKey);
            this.cachedApiKey = apiKey;
        } catch (error) {
            console.error('Failed to store API key:', error);
            throw new Error('Failed to securely store API key');
        }
    }

    async clearApiKey(): Promise<void> {
        try {
            await this.context.secrets.delete(API_KEY_SECRET_KEY);
            this.cachedApiKey = undefined;
        } catch (error) {
            console.error('Failed to clear API key:', error);
        }
    }

    async hasApiKey(): Promise<boolean> {
        const apiKey = await this.getApiKey();
        return apiKey !== undefined && apiKey.length > 0;
    }

    async promptForApiKey(): Promise<string | undefined> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Create State API key',
            placeHolder: 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
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
            },
        });

        if (apiKey) {
            await this.setApiKey(apiKey.trim());
            return apiKey.trim();
        }

        return undefined;
    }
}
