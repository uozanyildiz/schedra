# Releasing Schedra

## One-time setup

1. Create an npm account at <https://www.npmjs.com/signup> if needed.
2. Log in from the terminal:

   ```bash
   npm login --auth-type=web
   npm whoami
   ```

3. Confirm that the GitHub repository remote points to
   `https://github.com/uozanyildiz/schedra`.

## Publish

Run the complete release check:

```bash
pnpm release:check
```

Publish the package:

```bash
pnpm release:publish
```

Schedra is one npm package with `schedra/core`, `schedra/react`, and
`schedra/react-popover` entry points.

After publishing, verify them:

```bash
npm view schedra version
```
