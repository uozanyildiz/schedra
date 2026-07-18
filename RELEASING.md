# Releasing Karst

## One-time setup

1. Create an npm account at <https://www.npmjs.com/signup> if needed.
2. Log in from the terminal:

   ```bash
   npm login --auth-type=web
   npm whoami
   ```

3. Create and push the GitHub repository before publishing:

   ```bash
   gh repo create uozanyildiz/karst --public --source=. --remote=origin --push
   ```

## Publish

Run the complete release check:

```bash
pnpm release:check
```

Publish the package:

```bash
pnpm release:publish
```

Karst is one npm package with `karst/core`, `karst/react`, and
`karst/react-popover` entry points.

After publishing, verify them:

```bash
npm view karst version
```
