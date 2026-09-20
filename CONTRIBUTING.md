# Contributing to NEXORA POS

Thank you for your interest in contributing to NEXORA POS! We welcome bug reports, feature enhancements, and documentation improvements.

---

## 1. Development Workflow

### Prerequisites
- Node.js 20+ (LTS)
- npm or bun

### Local Setup
```bash
# 1. Clone repository
git clone https://github.com/your-org/nexora-pos.git
cd nexora-pos

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Code Quality & Standards

Before committing your changes, ensure that all linting and type checks pass:

```bash
# Run ESLint
npm run lint

# Check TypeScript compiler errors
npx tsc --noEmit

# Run production build
npm run build
```

### Conventions
- **TypeScript**: Strict mode enabled. No `any` without explicit justification.
- **Components**: Use Tailwind CSS utility classes; avoid inline styles.
- **Icons**: Import all icons strictly from `lucide-react`.
- **Database Operations**: Perform data mutations within Dexie transaction blocks to guarantee ACID compliance.

---

## 3. Pull Request Guidelines

1. Create a feature branch: `git checkout -b feature/your-feature-name`.
2. Commit your changes with clear, descriptive commit messages.
3. Ensure CI checks pass on GitHub Actions.
4. Submit a Pull Request targeting `main`.
