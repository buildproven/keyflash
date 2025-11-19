# Contributing to KeyFlash

Thank you for considering contributing to KeyFlash! We're building an open-source keyword research tool that's fast, simple, and affordable for everyone.

## How Can You Contribute?

### 🐛 Report Bugs

Found a bug? Please [open an issue](https://github.com/yourusername/keyflash/issues/new) with:

- **Clear title** describing the problem
- **Steps to reproduce** the bug
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment** (browser, OS, Node version)

### 💡 Suggest Features

Have an idea? [Start a discussion](https://github.com/yourusername/keyflash/discussions/new) with:

- **Problem statement**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Any other approaches?
- **Use cases**: Who would benefit and how?

### 📝 Improve Documentation

Documentation improvements are always welcome:

- Fix typos or unclear explanations
- Add examples or clarifications
- Write guides or tutorials
- Improve code comments

### 🔧 Submit Code

Ready to code? Follow the development workflow below.

## Development Workflow

### 1. Setup

```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR_USERNAME/keyflash.git
cd keyflash

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/keyflash.git

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Add your API keys to .env.local
```

### 2. Create a Branch

```bash
# Update your main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch Naming**:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks

### 3. Make Changes

- Write clean, readable code
- Follow existing code style
- Add/update tests for your changes
- Update documentation if needed
- Keep commits focused and atomic

### 4. Test Your Changes

```bash
# Run linter
pnpm lint

# Run type checker
pnpm type-check

# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Check test coverage
pnpm test:coverage
```

All checks must pass before submitting PR.

### 5. Commit

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <subject>

git commit -m "feat(api): add DataForSEO provider support"
git commit -m "fix(ui): correct keyword input validation"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(api): add rate limiting tests"
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

### 6. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# Fill in the PR template
```

### PR Guidelines

**Good PR**:

- Focused on a single concern
- Clear title and description
- Links to related issues
- Includes tests
- Updates documentation
- Passes all CI checks

**PR Template**:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

## Code Style

### TypeScript

```typescript
// ✅ Good
interface KeywordData {
  keyword: string
  searchVolume: number
  difficulty: number
}

async function fetchKeywords(
  keywords: string[],
  options: SearchOptions
): Promise<KeywordData[]> {
  // Implementation
}

// ❌ Avoid
function getKeywords(kws, opts) {
  // No types
}
```

### React Components

```typescript
// ✅ Good - Function components with TypeScript
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function Button({ onClick, children, disabled }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="btn"
    >
      {children}
    </button>
  );
}

// ❌ Avoid - Class components, no types
export class Button extends React.Component {
  render() {
    return <button onClick={this.props.onClick}>{this.props.children}</button>
  }
}
```

### Naming Conventions

- **Files**: `kebab-case.tsx`, `kebab-case.ts`
- **Components**: `PascalCase` (e.g., `KeywordSearchForm`)
- **Functions**: `camelCase` (e.g., `fetchKeywordData`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_KEYWORDS`)
- **Types/Interfaces**: `PascalCase` (e.g., `KeywordData`)

### File Organization

```typescript
// ✅ Good - Organized imports
import { useState, useEffect } from 'react'
import { z } from 'zod'

import { fetchKeywords } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { KeywordTable } from '@/components/tables/KeywordTable'

import type { KeywordData } from '@/types'

// Component code...

// ❌ Avoid - Messy imports
import { Button } from '@/components/ui/Button'
import { useState } from 'react'
import { fetchKeywords } from '@/lib/api'
import { z } from 'zod'
```

## Testing Guidelines

### Test Structure

```typescript
// ✅ Good - Clear, descriptive test
describe('KeywordSearchForm', () => {
  it('submits form with valid input', async () => {
    // Arrange
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<KeywordSearchForm onSubmit={onSubmit} />);

    // Act
    await user.type(screen.getByLabelText(/keywords/i), 'seo tools');
    await user.click(screen.getByRole('button', { name: /search/i }));

    // Assert
    expect(onSubmit).toHaveBeenCalledWith({
      keywords: ['seo tools'],
      matchType: 'phrase',
    });
  });
});

// ❌ Avoid - Vague test, no structure
test('form works', () => {
  render(<Form />);
  // Some assertions
});
```

### What to Test

**Do Test** ✅:

- User interactions
- Edge cases (empty input, max length)
- Error states
- Critical business logic
- API integrations (with mocks)

**Don't Test** ❌:

- Third-party libraries
- Implementation details
- Styling/visual appearance
- Private methods

## Documentation

### Code Comments

```typescript
// ✅ Good - Explain WHY, not WHAT
// Cache for 7 days because keyword data rarely changes weekly
const CACHE_TTL = 7 * 24 * 60 * 60

// Sanitize input to prevent injection attacks (OWASP Top 10)
function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[<>\"'&]/g, '')
}

// ❌ Avoid - Stating the obvious
// Set cache TTL to 7 days
const CACHE_TTL = 7 * 24 * 60 * 60

// Remove characters
function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[<>\"'&]/g, '')
}
```

### JSDoc for Complex Functions

````typescript
/**
 * Calculates keyword difficulty score (0-100) based on competition metrics
 *
 * @param competition - Competition level from API ('low' | 'medium' | 'high')
 * @param cpc - Cost per click in USD
 * @param searchVolume - Monthly search volume
 * @returns Difficulty score (0 = easy to rank, 100 = very hard)
 *
 * @example
 * ```typescript
 * const difficulty = calculateDifficulty('high', 5.50, 10000);
 * console.log(difficulty); // 85
 * ```
 */
function calculateDifficulty(
  competition: Competition,
  cpc: number,
  searchVolume: number
): number {
  // Implementation
}
````

## Communication

### Code Reviews

**As a Reviewer**:

- Be respectful and constructive
- Explain WHY, not just WHAT to change
- Approve when ready, request changes if needed
- Respond promptly (within 48 hours)

**As an Author**:

- Respond to all comments
- Ask for clarification if needed
- Don't take feedback personally
- Make requested changes or explain why not

### Asking for Help

- Check existing issues and discussions first
- Provide context and examples
- Share what you've tried
- Be patient and respectful

## Recognition

Contributors are recognized in several ways:

- Listed in `CONTRIBUTORS.md`
- Mentioned in release notes
- Invited to private contributor Discord (future)
- Opportunity to become maintainer

## Code of Conduct

### Our Standards

- Be welcoming and inclusive
- Respect differing viewpoints
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy toward others

### Unacceptable Behavior

- Harassment or discriminatory language
- Personal attacks or insults
- Trolling or inflammatory comments
- Publishing others' private information
- Other unprofessional conduct

### Enforcement

Violations may result in:

1. Warning
2. Temporary ban from community spaces
3. Permanent ban

Report issues to: conduct@keyflash.com

## Questions?

- **General questions**: [GitHub Discussions](https://github.com/yourusername/keyflash/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/yourusername/keyflash/issues)
- **Security issues**: security@keyflash.com (private disclosure)

---

**Thank you for contributing to KeyFlash!** 🎉

Every contribution, no matter how small, makes this project better for everyone.
