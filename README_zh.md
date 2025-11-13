<p align="center">
<img height="200" src="./assets/kv.png" alt="magic">
</p>
<p align="center"> <a href="./README.md">English</a> | 简体中文</p>

# Import Prompter

一个 VS Code 扩展，提供快速的依赖导入建议。它可以从你的 `package.json` 中自动检测依赖，并与 [export-what](https://github.com/Simon-He95/export-what) 无缝配合使用。

![demo](/assets/demo.gif)

## ✨ 特性

- 🚀 **快速导入建议** - 快速访问项目中所有依赖
- 📦 **智能检测** - 自动检测 `package.json` 中的依赖
- 🔄 **实时更新** - 监听依赖变化，自动刷新
- ⚙️ **可配置** - 自定义触发字符、排除包等
- 🎯 **多语言支持** - 支持 JavaScript、TypeScript、Vue 等

## 📖 使用方法

1. 输入 `_`（或你配置的触发字符）
2. 从建议列表中选择 `_import-prompter`
3. 选择你想要导入的包
4. 按下 <kbd>Tab</kbd> 跳回到 import 语句
5. 按下 <kbd>空格</kbd> 选择导出的依赖（配合 [export-what](https://github.com/Simon-He95/export-what) 使用）

扩展会自动检测 `package.json` 中新增的依赖。

## ⚙️ 配置选项

你可以通过 VS Code 设置来自定义扩展行为：

| 设置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `import-prompter.trigger` | string | `"_"` | 触发导入建议的字符 |
| `import-prompter.includePeerDependencies` | boolean | `true` | 是否包含 peer dependencies |
| `import-prompter.excludePackages` | array | `[]` | 要排除的包列表 |
| `import-prompter.supportedLanguages` | array | 见下方 | 支持的编程语言列表 |

**默认支持的语言：**
- `javascript`
- `javascriptreact`
- `typescript`
- `typescriptreact`
- `vue`

### 配置示例

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

## 🔧 安装

从 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=simonhe.import-prompter) 安装，或在 VS Code 扩展中搜索 "import-prompter"。

## 🤝 相关扩展

- [export-what](https://github.com/Simon-He95/export-what) - 显示选定包的可用导出

## :coffee:

[请我喝一杯咖啡](https://github.com/Simon-He95/sponsor)

## 📄 许可证

[MIT](./LICENSE)

## 💖 赞助者

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.svg">
    <img src="https://cdn.jsdelivr.net/gh/Simon-He95/sponsor/sponsors.png"/>
  </a>
</p>
