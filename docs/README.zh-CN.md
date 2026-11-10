# AE AI Studio · Beta 1.0.0

在 After Effects 内用自然语言提出需求，先查看执行计划，再创建图层和动画的独立 CEP 面板。

**版本：** `1.0.0-beta.1` · **许可证：** [仅限使用 · 禁止再分发及转售](../LICENSE) · **界面：** 한국어 / English / 简体中文

[한국어](../README.md) · [English](README.en.md) · [测试说明](TESTING.md)

无需 Higgsfield 或 Magnetic 订阅。可连接 OpenAI GPT、Anthropic Claude 的 API，也可通过 Ollama 使用本地模型。云端服务需要相应的 API 访问权限与密钥，费用由各提供方政策决定。本地模型无需付费 AI 订阅或 API 密钥，速度取决于硬件与模型。

## 功能

- 创建合成、空对象、文字、纯色、矩形、椭圆与调整图层。
- 设置新建二维图层的 Position、Scale、Rotation、Opacity、Anchor Point。
- 创建 Linear / Ease 关键帧、新建图层之间的父子关系与合成标记。
- 离线演示、执行前预览、每次执行使用一个 Undo 组。
- API 密钥仅保存在当前面板会话内存中，可取消网络请求。

本测试版不修改或删除原有图层，不执行 AI 生成的代码或 Expression，不支持任意效果、文件导入或渲染。

## 安装

完整解压 ZIP，确保 `extension`、`scripts`、`docs` 位于同一目录。关闭 After Effects。

Windows：在解压目录打开终端并运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -EnableDebugMode
```

macOS：

```bash
bash scripts/install-macos.sh --enable-debug-mode
```

重新启动 AE，打开 **Window → Extensions → AE AI Studio**。不需要管理员权限。

安装位置：

- Windows：`%APPDATA%\Adobe\CEP\extensions\com.aeaistudio.panel`
- macOS：`~/Library/Application Support/Adobe/CEP/extensions/com.aeaistudio.panel`

旧版本会保存在 `Adobe/CEP/ae-ai-studio-backups` 下，不放在被扫描的 extensions 目录内。

这是未签名的开发测试版。显式安装选项会为当前用户启用 **CSXS.11 与 CSXS.12 的 CEP 调试模式**，同时允许其他未签名的 CEP 扩展。若已启用，可省略该选项。安装器不会永久更改 PowerShell 的执行策略。

## 第一次使用

1. 选择界面语言和 Provider。
2. 输入账号可用的 Model ID。云端提供方还需输入 API key。
3. 激活要接收新图层的合成，或在需求中指定新建合成。
4. 输入需求并生成计划。
5. 阅读预览后执行。
6. 使用 Windows 的 **Ctrl+Z** 或 macOS 的 **Cmd+Z** 撤销。

示例：

> 新建1920×1080、30fps、5秒的合成，在中央添加白色文字“MOTION”，并让不透明度从0秒的0变为1秒的100。

密钥不写入文件或设置。失败的付费请求不会自动重试。

### Ollama 本地模型

单独安装 [Ollama](https://ollama.com/)，下载模型，例如 `ollama pull qwen2.5:7b`。运行 Ollama 应用或服务；需要时使用 `ollama serve`。在面板中选择 Ollama，填写已下载模型的 ID，无需 API key。

本地地址固定为 `http://127.0.0.1:11434`。建议先提出简短、具体的需求；较小模型可能生成无效计划。

## 数据与限制

仅将输入需求和允许分享的合成摘要发送给所选提供方。合成信息分享默认开启，可在面板中关闭。仅分享宽度、高度、时长、帧率与当前时间，不发送合成名或图层名。不会自动上传素材、音频、工程文件或截图。本地 Ollama 请求发送到上述回环地址。

每个计划最多 **40 项操作**、总计 **200 个关键帧**。新合成每边最多 **4096px**、最长 **300 秒**、最高 **120fps**。Transform 与父子关系只能引用本计划创建的图层。

执行前会再次检查当前合成。切换合成后请重新生成计划。宿主程序出错时可能留下部分结果，请阅读提示并用 Undo 恢复。

## 开发与验证

开发需要 **Node.js 18+**，无外部 npm 依赖。

```bash
npm test
npm run package
```

ZIP 与 SHA-256 校验文件输出到 `dist/`。使用 **JavaScript + ExtendScript**，不需要 Java 运行环境。AE 使用 CEP 内置运行环境。

目标为 AE 2022 及以上版本。清单允许的版本范围不代表每个版本都已实测。自动测试使用模拟 AE 与网络环境；真实 AE、API 和本地模型的运行需按 [TESTING.md](TESTING.md) 手动验证。

若面板未出现，请检查完整解压、用户安装目录、调试模式与 AE 重启。在普通浏览器中打开 `index.html` 无法创建 AE 图层。

## 卸载

关闭 AE，仅删除安装位置的 `com.aeaistudio.panel` 文件夹。恢复旧版本时将备份复制回该位置。

如需关闭调试模式，将 CSXS.11 和 CSXS.12 的 `PlayerDebugMode` 设为 `0`。此操作也会影响其他未签名 CEP 面板。具体命令见 [韩文说明](../README.md)。

## 许可证

采用 [AE AI Studio Use-Only License 1.0](../LICENSE)。允许个人学习、内部使用、商业创作、私下修改及备份。未经权利人事先书面许可，禁止免费或付费再分发、转售、再许可或捆绑分发软件、修改版及其主要源代码部分。

不包含软件主要代码的渲染视频、图片、MV/BGA 作品及独立工程成果可以公开、交付客户及出售。可以分享官方下载链接。

新条件自2026-11-10（韩国时间）的许可证变更提交起适用，应用版本保持 `1.0.0-beta.1`。不追溯撤销先前 MIT 版本已授予的权利；[先前 MIT 提交](https://github.com/wa13sans/ae-ai-studio/tree/f42fd4f73a69f3c56963b068cd613b417888f158)仍遵循原有条件。

这是限制性自定义许可证，并非开源许可证。GitHub 对公开仓库的查看和站内 fork 权利、适用法律例外及第三方条款不受影响。Adobe 软件和 AI 服务各自的服务条款仍然适用。
