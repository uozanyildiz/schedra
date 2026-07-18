# Releasing Karst

## One-time setup

1. Create an npm account at <https://www.npmjs.com/signup> if needed.
2. Create the public `karst` organization at
   <https://www.npmjs.com/org/create> or confirm that your account can publish
   packages in the `@karst` scope.
3. Log in from the terminal:

   ```bash
   npm login --auth-type=web
   npm whoami
   ```

4. Create and push the GitHub repository before publishing:

   ```bash
   gh repo create uozanyildiz/karst --public --source=. --remote=origin --push
   ```

## Publish

Run the complete release check:

```bash
pnpm release:check
```

Publish all packages in dependency order:

```bash
pnpm release:publish
```

Do not use `npm publish` directly in a package directory. npm does not replace
pnpm's `workspace:` dependency ranges. The release script uses pnpm, which
converts them to normal package versions in the published tarballs.

The packages are published in this order:

1. `@karst/core`
2. `@karst/react`
3. `@karst/react-popover`

After publishing, verify them:

```bash
npm view @karst/core version
npm view @karst/react version
npm view @karst/react-popover version
```
