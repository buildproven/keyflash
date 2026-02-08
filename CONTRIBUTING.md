# Contributing to KeyFlash

## Development Setup

```bash
npm install
cp .env.example .env.local
npm run redis:start
npm run dev
```

See `.env.example` for environment variable documentation.

## Making Changes

1. Branch from `main`: `git checkout -b feature/your-feature-name`
2. Use conventional commits: `feat(scope): description`
3. Keep commits atomic

## Testing

All changes require tests. Maintain 70%+ coverage.

```bash
npm test              # All tests
npm run test:unit     # Unit only
npm run test:e2e      # E2E only
npm run test:coverage # Coverage report
```

## PR Checklist

Before opening a pull request:

- [ ] `npm run type-check:all` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] New code has tests
- [ ] No `any` types introduced
- [ ] No secrets exposed

## Security Reporting

Found a security vulnerability? Please report it privately:

1. **Do NOT** open a public issue
2. Email details to the maintainers
3. Include steps to reproduce
4. Allow time for a fix before disclosure

See [docs/SECURITY.md](docs/SECURITY.md) for full security guidelines.

## Bug Reports

Include: description, reproduction steps, expected vs actual behavior, Node/npm versions.

## License

Contributions are licensed under the MIT License.

---

> **BuildProven LLC** · [buildproven.ai](https://buildproven.ai)
