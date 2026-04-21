<p align="center">
<img height="200" src="https://raw.githubusercontent.com/Simon-He95/import-prompter/main/assets/kv.png" alt="magic">
</p>
<p align="center"><a href="https://github.com/Simon-He95/import-prompter/blob/main/README.md">English</a> | 简体中文</p>

# Import Prompter

一个 VS Code 扩展，提供来自项目依赖和 `pnpm-workspace.yaml` 包的快速导入建议，并可与 [export-what](https://github.com/Simon-He95/export-what) 配合使用。

![demo](https://raw.githubusercontent.com/Simon-He95/import-prompter/main/assets/demo.gif)

## 特性

- 从 `package.json` 快速生成导入建议
- 自动识别 `pnpm-workspace.yaml` 中的 workspace 包
- 依赖文件变更后自动刷新
- 可配置触发字符、排除包和支持语言
- 支持 JavaScript、React、TypeScript、Vue、Svelte 和 Astro

## 使用方法

1. 输入 `_` 或你配置的触发字符。
2. 从建议列表中直接选择你想导入的包。
3. 按下 <kbd>Tab</kbd> 跳回到 import 绑定位置。
4. 按下 <kbd>Space</kbd> 选择 [export-what](https://github.com/Simon-He95/export-what) 提供的导出项。

## 配置项

| 设置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `import-prompter.trigger` | string | `"_"` | 触发导入建议的字符 |
| `import-prompter.includePeerDependencies` | boolean | `true` | 是否包含 peer dependencies |
| `import-prompter.excludePackages` | array | `[]` | 要排除的包列表 |
| `import-prompter.supportedLanguages` | array | 见下方 | 支持的编程语言列表 |

默认支持的语言：
- `javascript`
- `javascriptreact`
- `typescript`
- `typescriptreact`
- `vue`
- `svelte`
- `astro`

配置示例：

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

## 安装

从 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=simonhe.import-prompter) 安装，或在 VS Code 扩展中搜索 `import-prompter`。

## 相关扩展

- [export-what](https://github.com/Simon-He95/export-what) 用于补全包的导出项

## 许可证

MIT
