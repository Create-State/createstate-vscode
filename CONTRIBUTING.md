# Contributing to Create State VS Code Extension

Thank you for your interest in contributing! This extension integrates [Create State](https://createstate.ai) - an AI-powered knowledge graph for codebases - into VS Code.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- VS Code 1.85+

### Setup

```bash
git clone https://github.com/Create-State/createstate-vscode.git
cd createstate-vscode
npm install
npm run compile
```

### Running in Development

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. The extension will be active in the new VS Code window

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Project Structure

```
src/
  extension.ts        # Entry point, activation
  mcpClient.ts        # MCP JSON-RPC client
  auth.ts             # API key management
  commands.ts         # VS Code commands
  sidebarProvider.ts  # Sidebar webview
  chatParticipant.ts  # Copilot Chat integration

tests/
  __mocks__/vscode.ts # VS Code API mock
  mcpClient.test.ts   # Client tests
  chatParticipant.test.ts # Intent inference tests
  auth.test.ts        # Auth tests
```

## Making Changes

### Code Style

- TypeScript with strict mode
- ESLint for linting (`npm run lint`)
- Prefer async/await over callbacks
- Add JSDoc comments for public APIs

### Testing

- Write tests for new functionality
- Ensure existing tests pass
- Test both success and error cases

### Commit Messages

Follow conventional commits:

```
feat: add new command for X
fix: handle error case in Y
docs: update README with Z
test: add tests for W
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Ensure all tests pass (`npm test`)
5. Ensure linting passes (`npm run lint`)
6. Commit with a descriptive message
7. Push to your fork
8. Open a Pull Request

### PR Guidelines

- Keep PRs focused on a single change
- Update documentation if needed
- Add tests for new functionality
- Describe the change and motivation in the PR description

## Dependency Notes

### minimatch vulnerability

`npm audit` reports a ReDoS vulnerability in `minimatch` (transitive dependency via `vsce` and others). We intentionally do not override this because:

1. **vsce compatibility**: Overriding to minimatch 9.x breaks `vsce package` due to ESM/CommonJS export differences
2. **Low risk**: The vulnerability requires processing malicious glob patterns, which doesn't apply to dev tooling
3. **Transitive**: We don't control the dependency - it's used by vsce, jest, and other dev tools

This is a known, accepted risk for development dependencies only. The extension runtime has no minimatch dependency.

## Reporting Issues

When reporting issues, please include:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## Feature Requests

We welcome feature requests! Please check existing issues first to avoid duplicates.

## Code of Conduct

Be respectful and constructive. We're all here to make development better.

## Questions?

- Open an issue for bugs or features
- Check [Create State documentation](https://createstate.ai/web/documentation) for API questions
- Email support@createstate.ai for account issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
