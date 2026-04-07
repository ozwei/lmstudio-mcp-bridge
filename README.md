# LM Studio MCP Bridge

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

A Node.js based Model Context Protocol (MCP) bridge that enables **Antigravity** (and other MCP clients) to interact with locally hosted Large Language Models (LLMs) via **LM Studio**.

## Overview

This bridge acts as a translation layer between the MCP standard and LM Studio's OpenAI-compatible and native administrative APIs. It allows AI assistants to autonomously query, load, and manage local models running on your hardware.

## Features

- 💬 **Query Local LLMs**: Standard text generation with JSON Schema support.
- 📊 **Model Listing**: Retrieve a comprehensive list of all loaded models.
- 🌡️ **Error Handling**: Graceful recovery from model loading or inference failures.

## User Scenarios: Why Use This Bridge?

This bridge transforms Antigravity from a cloud-only assistant into a hybrid powerhouse that respects your privacy and hardware.

### 1. 🛡️ Privacy-First Code Analysis
Instead of sending proprietary code or sensitive files to the cloud, you can ask Antigravity to use your local Llama 3 model. The code stays on your machine; only the final analysis result is sent back to the cloud assistant.

### 2. 📚 Local RAG (Knowledge Search)
By using `get_local_embeddings`, you can index thousands of local PDFs or Markdown notes. When you ask a question, Antigravity can search your local drive, find the relevant passage, and use that context to answer you, keeping your personal data private.

### 3. ⚡ Efficiency & Cost Optimization
For repetitive, low-complexity tasks like "fix the capitalization in these 50 files," Antigravity can delegate the work to a lightweight local model (like `Nemotron-Mini`), saving your cloud token quota for harder reasoning tasks.

### 4. 🧪 Automated AI Benchmarking
If you are an AI developer, you can use Antigravity to script the loading and unloading of different quantized models (Q4, Q8, etc.) to test performance and accuracy across various architectures automatically.

### 5. 🌡️ Resource-Aware Computing
With the `get_system_health` tool, Antigravity can check your available VRAM before deciding whether to load a heavy model, preventing system crashes and ensuring a smooth hybrid experience.

## Prerequisites

- **LM Studio**: version 0.3.0+ (with Local Server enabled on port `1234`).
- **Node.js**: v18.0.0 or higher.
- **MCP Client**: Such as Antigravity, Claude Desktop, or any tool that supports the Model Context Protocol.

## Getting Started

### 1. Installation

Clone this repository and install the required dependencies:

```bash
git clone https://github.com/ozwei/lmstudio-mcp-bridge.git
cd lmstudio-mcp-bridge
npm install
```

### 2. Configuration

Create a `.env` file in the root directory (you can copy from `.env.example`) and fill in your LM Studio details:

```env
LM_HOST=localhost
LM_PORT=1234
LM_API_TOKEN=your_token_here
```

> [!NOTE]
> The `.env` file is excluded from Git to protect your sensitive configuration.

### 3. Architecture: Using with LM Link

If you are using **LM Link** to connect multiple devices:

1. **Setup**: Run LM Studio on both your "Server" (powerful machine) and "Client" (where you are coding).
2. **Connectivity**: Enable LM Link to share the server's models with the client.
3. **Bridge Placement**: Run the `lmstudio-mcp-bridge` on your **Client** machine.
4. **Proxying**: Set `LM_HOST=localhost` in your `.env`. The bridge will talk to your local client, which will transparently route requests to the remote models via the secure link.

**Data Flow:**
`IDE (Antigravity/Claude Code) -> MCP Bridge -> Local LM Studio Client -> LM Link -> Remote LM Studio Server`

### 4. Usage in Antigravity

Add the bridge to your MCP settings:

```json
{
  "mcpServers": {
    "lmstudio-bridge": {
      "command": "node",
      "args": ["C:/absolute/path/to/lmstudio-mcp-bridge/src/index.js"]
    }
  }
}
```

## Available Tools

- `query_local_llm`: Main tool for chat completions. Supports `json_mode` and `json_schema` (Structured Output).
- `list_local_models`: List all loaded models.

---

## Advanced Examples

### 🧱 Structured Data (JSON Schema)
Force the model to return valid JSON following a specific schema.
```json
{
  "prompt": "Generate a random user profile",
  "json_schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "integer" }
    },
    "required": ["name", "age"]
  }
}
```

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
