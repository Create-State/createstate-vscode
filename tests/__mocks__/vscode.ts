/**
 * Mock VS Code API for unit testing
 */

export const workspace = {
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue('https://createstate.ai'),
    }),
    name: 'test-workspace',
    asRelativePath: jest.fn((uri: any) => uri.fsPath || uri),
};

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    createStatusBarItem: jest.fn().mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        text: '',
        tooltip: '',
        command: '',
        backgroundColor: undefined,
    }),
    createWebviewPanel: jest.fn().mockReturnValue({
        webview: { html: '' },
        dispose: jest.fn(),
    }),
    withProgress: jest.fn(async (_options: any, task: any) => {
        return task({ report: jest.fn() });
    }),
    activeTextEditor: undefined,
    registerWebviewViewProvider: jest.fn(),
};

export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn(),
};

export const Uri = {
    file: jest.fn((path: string) => ({ fsPath: path })),
    parse: jest.fn((uri: string) => ({ toString: () => uri })),
};

export const ThemeIcon = jest.fn().mockImplementation((id: string) => ({ id }));

export const ThemeColor = jest.fn().mockImplementation((id: string) => ({ id }));

export const StatusBarAlignment = {
    Left: 1,
    Right: 2,
};

export const ProgressLocation = {
    Notification: 15,
    SourceControl: 1,
    Window: 10,
};

export const ExtensionContext = jest.fn().mockImplementation(() => ({
    subscriptions: [],
    secrets: {
        get: jest.fn(),
        store: jest.fn(),
        delete: jest.fn(),
    },
    extensionUri: { fsPath: '/test/extension' },
}));

export const chat = {
    createChatParticipant: jest.fn().mockReturnValue({
        iconPath: undefined,
        followupProvider: undefined,
        dispose: jest.fn(),
    }),
};

export class CancellationTokenSource {
    token = { isCancellationRequested: false };
    cancel = jest.fn();
    dispose = jest.fn();
}

export default {
    workspace,
    window,
    commands,
    Uri,
    ThemeIcon,
    ThemeColor,
    StatusBarAlignment,
    ProgressLocation,
    ExtensionContext,
    chat,
    CancellationTokenSource,
};
