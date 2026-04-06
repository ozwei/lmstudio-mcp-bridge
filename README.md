# LM Studio MCP Bridge

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

A Node.js based Model Context Protocol (MCP) bridge that allows **Antigravity** (and other MCP clients) to interact with locally hosted LLMs on **LM Studio**.

[繁體中文說明](#繁體中文) | [English Documentation](#english)

---

<a name="english"></a>
## English

### Features
- **Query Local LLMs**: Generate text using models hosted in LM Studio.
- **Model Management**: Dynamically `load` and `unload` GGUF models.
- **Local Embeddings**: Convert text to vectors using local models (e.g., Nomic Embed).
- **System Insights**: List available models and detailed technical status.

### Prerequisites
- [LM Studio](https://lmstudio.ai/) running with Local Server enabled (default port `1234`).
- [Node.js](https://nodejs.org/) (v18 or higher recommended).
- [Antigravity](https://gemini.google.com/antigravity) or any MCP-compatible environment.

### Setup
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update the `LM_HOST` in `src/index.js` to your LM Studio's IP address (default is `192.168.1.131`).
4. Add the following to your Antigravity MCP configuration:
   ```json
   {
     "mcpServers": {
       "lmstudio-bridge": {
         "command": "node",
         "args": ["path/to/lmstudio-mcp-bridge/src/index.js"]
       }
     }
   }
   ```

---

<a name="繁體中文"></a>
## 繁體中文

### 功能特色
- **本地 LLM 查詢**：使用 LM Studio 託管的模型進行文本生成。
- **模型管理**：支援動態 `load`（載入）與 `unload`（卸載）GGUF 模型。
- **本地向量化 (Embeddings)**：使用本地模型（如 Nomic Embed）將文字轉換為向量。
- **系統清單**：列出所有可用的模型及其詳細技術狀態。

### 前提條件
- 已安裝 [LM Studio](https://lmstudio.ai/) 並開啟本地伺服器（預設連接埠 `1234`）。
- 已安裝 [Node.js](https://nodejs.org/)（建議 v18 以上版本）。
- 已安裝 [Antigravity](https://gemini.google.com/antigravity) 或任何支援 MCP 的環境。

### 安裝步驟
1. 克隆 (Clone) 此儲存庫。
2. 安裝依賴套件：
   ```bash
   npm install
   ```
3. 修改 `src/index.js` 中的 `LM_HOST` 為你的 LM Studio IP 地址。
4. 將伺服器配置加入你的 Antigravity MCP 設定中。

## License
Distributed under the ISC License. See `LICENSE` for more information.
