# InputTip Cursor Sync

`InputTip Cursor Sync` 是一个运行在 Windows 上的 VS Code 扩展，用于根据当前输入状态自动切换 VS Code 中与输入焦点相关的颜色。

- `CN`：中文输入状态
- `EN`：英文输入状态
- `Caps`：`Caps Lock` 已开启

扩展本身不直接读取 IME 状态，而是监听系统临时目录中的一个状态文件，并在状态变化时更新 `workbench.colorCustomizations.editorCursor.foreground`。

> 2026年04月14日 23时38分32秒
> 非常感谢作者的认可。我已经更新并适配了%TEMP%\abgox.InputTip.State，一直在使用InputTip它真的非常棒。感谢您的投入。
> <img width="1299" height="406" alt="Image" src="https://github.com/user-attachments/assets/cd6e75b3-5771-407c-977a-4e357874808c" />
>
> 官方插件地址为：[InputTip for VSCode](https://marketplace.visualstudio.com/items?itemName=abgox.inputtip)

## 工作原理

1. 外部脚本将当前输入状态优先写入 `%TEMP%\abgox.InputTip.State`
2. 扩展优先监听这个文件；如果没有可用内容，则回退到 `%TEMP%\inputtip-vscode-state.txt`
3. 当文件内容变成 `CN`、`EN` 或 `Caps` 时，扩展立即更新颜色

当前会同步以下区域：

- 编辑器光标
- 终端光标
- 多光标颜色
- 输入框、搜索过滤框、列表/资源管理器焦点边框

这种设计把 IME 检测交给更适合处理 Windows 输入法状态的外部工具，VS Code 扩展侧只负责读取状态并应用颜色。

## 运行要求

- Windows
- VS Code `1.85.0` 或更高版本
- 一个持续写入状态文件的后台脚本

支持的状态文件路径如下：

- 首选：`%TEMP%\abgox.InputTip.State`
- 兼容回退：`%TEMP%\inputtip-vscode-state.txt`

## 安装

- 打开 VS Code
- 打开扩展管理器（`Ctrl + Shift + X`），搜索 `InputTip Cursor Sync` 并安装

## 配置项

扩展提供以下三个配置项：

- `inputTipCursorSync.cnColor`：输入状态为 `CN` 时的光标颜色
- `inputTipCursorSync.enColor`：输入状态为 `EN` 时的光标颜色
- `inputTipCursorSync.capsColor`：输入状态为 `Caps` 时的光标颜色

默认值如下：

```json
{
  "inputTipCursorSync.cnColor": "#ff4d4f",
  "inputTipCursorSync.enColor": "#4096ff",
  "inputTipCursorSync.capsColor": "#52c41a"
}
```

## 与 InputTip 集成

如果你正在使用 `InputTip` 和 `AutoHotkey`，可以创建一个 `plugins/custom-ime-sync.ahk` 文件，然后在主插件文件中引入它。

示例：

```autohotkey
global __sync_last_state := ""
global __sync_file := A_Temp "\abgox.InputTip.State"

SetTimer(BroadcastImeState, 50)

BroadcastImeState() {
    global __sync_last_state, __sync_file

    try {
        if (GetKeyState("CapsLock", "T")) {
            state := "Caps"
        } else {
            state := isCN() ? "CN" : "EN"
        }

        if (state = __sync_last_state) {
            return
        }

        __sync_last_state := state

        if FileExist(__sync_file) {
            FileDelete(__sync_file)
        }

        FileAppend(state, __sync_file, "UTF-8")
    }
}
```

然后在 `InputTip.plugin.ahk` 中加入：

```autohotkey
#Include custom-ime-sync.ahk
```

## 注意事项

- 扩展会更新全局配置 `workbench.colorCustomizations`
- 如果其他扩展或你自己的设置也在修改 `editorCursor.foreground`，则以最后一次写入为准
- VS Code 目前没有为所有输入框公开统一的“插入光标颜色”主题键，因此搜索框、资源管理器等区域会通过焦点边框颜色来反映状态，而不是始终直接改变文本插入光标颜色
- 如果状态文件不存在，扩展不会报错，只会等待有效状态出现
- 当前只识别 `CN`、`EN` 和 `Caps`

## 故障排查

### 光标颜色没有变化

请检查以下几点：

1. `%TEMP%\abgox.InputTip.State` 是否存在；如果你还在用旧脚本，再检查 `%TEMP%\inputtip-vscode-state.txt`
2. 文件内容是否严格等于 `CN`、`EN` 或 `Caps`
3. 外部脚本是否仍在运行，并且确实写入了首选路径或兼容路径
4. 扩展是否已在 VS Code 中安装并启用

## License

当前仓库还没有包含 `LICENSE`、`LICENSE.md` 或 `LICENSE.txt`。如果你准备公开发布，建议先补齐许可证文件。
