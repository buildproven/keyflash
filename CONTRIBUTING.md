# Contributing to KeyFlash

Thank you for your interest in contributing to KeyFlash! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guidelines](#style-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project follows a standard code of conduct:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/keyflash.git
   cd keyflash
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/vibebuildlab/keyflash.git
   ```

## Development Setup

### Prerequisites

- Node.js 20.11.1+ (managed via Volta)
- npm 10.2.4+
- Docker (for local Redis)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start local Redis (for caching)
npm run redis:start

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Environment Configuration

KeyFlash uses environment variables for configuration. Key variables:

- `KEYWORD_API_PROVIDER` - API provider: `mock` (default), `google-ads`, or `dataforseo`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Redis connection
- `BILLING_ENABLED` - Set to `true` to enable Stripe payments (disabled by default)
- `PRIVACY_MODE` - Set to `true` to disable keyword caching

See `.env.example` for all available options.

## Making Changes

### Branching Strategy

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes with clear, atomic commits

3. Keep your branch up to date:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### Commit Messages

Follow conventional commit format:

```
type(scope): brief description

Detailed explanation (optional)
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(api): add related keywords endpoint
fix(cache): prevent race condition in Redis cache
docs(readme): update installation instructions
```

## Testing

KeyFlash has comprehensive test coverage. All changes should include tests.

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Requirements

- **Unit tests** for new functions/utilities
- **Integration tests** for API routes
- **E2E tests** for user-facing features
- Maintain **70%+ coverage** (enforced by CI)

## Submitting Changes

### Quality Checks

Before submitting, ensure all checks pass:

```bash
# Type checking
npm run type-check:all

# Linting
npm run lint

# Tests
npm test

# All quality checks
npm run quality:check
```

### Creating a Pull Request

1. **Push your changes** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what and why
   - Link to related issues (if any)
   - Screenshots (for UI changes)

3. **CI checks must pass**:
   - TypeScript compilation
   - ESLint/Stylelint
   - All tests
   - No security vulnerabilities

4. **Code review**: Maintainers will review your PR. Be responsive to feedback.

## Style Guidelines

### Code Style

- **TypeScript**: Use proper types, avoid `any`
- **React**: Use functional components and hooks
- **Naming**:
  - Components: PascalCase (`KeywordSearch.tsx`)
  - Files: kebab-case (`keyword-search.ts`)
  - Functions: camelCase (`getKeywordData`)
- **Formatting**: Prettier handles formatting automatically

### Project Conventions

- **No `any` types** - Use proper TypeScript interfaces
- **No unused variables** - Clean up code properly
- **Security first** - Never expose secrets, use environment variables
- **Follow existing patterns** - Match the project's code style

### Architecture

- API routes in `src/app/api/`
- Components in `src/components/`
- Utilities in `src/lib/`
- Tests mirror source structure in `tests/`

See `docs/ARCHITECTURE.md` for detailed architecture information.

## Reporting Bugs

### Before Reporting

1. **Search existing issues** to avoid duplicates
2. **Test with latest version** to see if already fixed
3. **Reproduce consistently** before reporting

### Bug Report Template

Include:

- **Description**: Clear summary of the bug
- **Steps to Reproduce**: Numbered steps to recreate
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**:
  - Node version
  - npm version
  - Browser (if relevant)
  - OS
- **Additional Context**: Screenshots, logs, etc.

## Requesting Features

### Feature Request Template

Include:

- **Problem**: What problem does this solve?
- **Proposed Solution**: How should it work?
- **Alternatives Considered**: Other approaches you've thought about
- **Additional Context**: Use cases, examples, screenshots

### Feature Discussion

- Start with an issue to discuss the feature
- Get maintainer buy-in before implementing
- Large features may require design review

## Additional Resources

- [README.md](README.md) - Project overview
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [docs/SECURITY.md](docs/SECURITY.md) - Security guidelines
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) - Feature specifications

## Questions?

- Open a **GitHub Discussion** for questions
- Check existing **Issues** and **PRs** for similar topics
- Join our community (links in README)

## License

By contributing to KeyFlash, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to KeyFlash! 🚀
