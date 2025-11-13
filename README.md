<p align="center">
<img height="200" src="./assets/kv.png" alt="magic">
</p>
<p align="center"> English | <a href="./README_zh.md">简体中文</a></p>

# Import Prompter

A VS Code extension that provides fast import suggestions from your project dependencies. It prioritizes packages from your `package.json` and works seamlessly with [export-what](https://github.com/Simon-He95/export-what).

![demo](/assets/demo.gif)

## ✨ Features

- 🚀 **Fast Import Suggestions** - Quick access to all your project dependencies
- 📦 **Smart Detection** - Automatically detects dependencies from `package.json`
- 🔄 **Live Updates** - Watches for changes in your package dependencies
- ⚙️ **Configurable** - Customize trigger character, exclude packages, and more
- 🎯 **Multi-language Support** - Works with JavaScript, TypeScript, Vue, and more

## 📖 Usage

1. Type `_` (or your configured trigger character)
2. Select `_import-prompter` from the suggestion list
3. Choose the package you want to import
4. Press <kbd>Tab</kbd> to jump back to the import statement
5. Press <kbd>Space</kbd> to select exported dependencies (works with [export-what](https://github.com/Simon-He95/export-what))

The extension will automatically detect new dependencies added to your `package.json`.

## ⚙️ Configuration

You can customize the extension behavior through VS Code settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `import-prompter.trigger` | string | `"_"` | Character that triggers import suggestions |
| `import-prompter.includePeerDependencies` | boolean | `true` | Include peer dependencies in suggestions |
| `import-prompter.excludePackages` | array | `[]` | List of packages to exclude from suggestions |
| `import-prompter.supportedLanguages` | array | See below | List of supported programming languages |

**Default supported languages:**
- `javascript`
- `javascriptreact`
- `typescript`
- `typescriptreact`
- `vue`

### Example Configuration

```json
{
  "import-prompter.trigger": "_",
  "import-prompter.includePeerDependencies": true,
  "import-prompter.excludePackages": ["@types/*"],
  "import-prompter.supportedLanguages": [
    "javascript",
    "typescript",
    "vue",
    "svelte"
  ]
}
```

## 🔧 Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=simonhe.import-prompter) or search for "import-prompter" in VS Code extensions.

## 🤝 Related Extensions

- [export-what](https://github.com/Simon-He95/export-what) - Shows available exports from selected packages

## :coffee:

[Buy me a cup of coffee](https://github.com/Simon-He95/sponsor)

## 📄 License

[MIT](./LICENSE)

## 💖 Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>
