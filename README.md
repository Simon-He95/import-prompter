<p align="center">
<img height="200" src="https://raw.githubusercontent.com/Simon-He95/import-prompter/main/assets/kv.png" alt="magic">
</p>
<p align="center">English | <a href="https://github.com/Simon-He95/import-prompter/blob/main/README_zh.md">简体中文</a></p>

# Import Prompter

A VS Code extension that provides fast import suggestions from your project dependencies and `pnpm-workspace.yaml` packages. It works seamlessly with [export-what](https://github.com/Simon-He95/export-what).

![demo](https://raw.githubusercontent.com/Simon-He95/import-prompter/main/assets/demo.gif)

## Features

- Fast import suggestions from `package.json`
- Workspace package detection from `pnpm-workspace.yaml`
- Live updates when dependency files change
- Configurable trigger, package excludes, and supported languages
- Works with JavaScript, React, TypeScript, Vue, Svelte, and Astro

## Usage

1. Type `_` or your configured trigger character.
2. Pick the package you want to import from the suggestion list.
3. Press <kbd>Tab</kbd> to jump back to the import binding.
4. Press <kbd>Space</kbd> to select exports from [export-what](https://github.com/Simon-He95/export-what).

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `import-prompter.trigger` | string | `"_"` | Character that triggers import suggestions |
| `import-prompter.includePeerDependencies` | boolean | `true` | Include peer dependencies in suggestions |
| `import-prompter.excludePackages` | array | `[]` | List of packages to exclude from suggestions |
| `import-prompter.supportedLanguages` | array | See below | List of supported programming languages |

Default supported languages:
- `javascript`
- `javascriptreact`
- `typescript`
- `typescriptreact`
- `vue`
- `svelte`
- `astro`

Example configuration:

```json
{
  "import-prompter.trigger": "_",
  "import-prompter.includePeerDependencies": true,
  "import-prompter.excludePackages": ["@types/*"],
  "import-prompter.supportedLanguages": [
    "javascript",
    "typescript",
    "vue",
    "svelte",
    "astro"
  ]
}
```

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=simonhe.import-prompter) or search for `import-prompter` in VS Code extensions.

## Related Extension

- [export-what](https://github.com/Simon-He95/export-what) for package export suggestions

## License

MIT
