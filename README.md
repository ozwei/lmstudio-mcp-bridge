# LM Studio MCP Bridge

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

A Node.js based Model Context Protocol (MCP) bridge that enables **Antigravity** (and other MCP clients) to interact with locally hosted Large Language Models (LLMs) via **LM Studio**.

## Overview

This bridge acts as a translation layer between the MCP standard and LM Studio's OpenAI-compatible and native administrative APIs. It allows AI assistants to autonomously query, load, and manage local models running on your hardware.

## Features

- 💬 **Query Local LLMs**: Generate text directly using your hosted models.
- 🔄 **Model Management**: Support for dynamically `loading` and `unloading` GGUF models via API.
- 🧠 **Local Embeddings**: Convert text into vector embeddings using specialized models (e.g., Nomic Embed), ideal for local RAG implementations.
- 📊 **Detailed Status**: Retrieve a comprehensive list of all loaded models and their technical details.

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

Open `src/index.js` and ensure the `LM_HOST` constant matches your machine's IP address:

```javascript
const LM_HOST = "192.168.1.131"; // Update this to your LM Studio host IP
```

### 3. Usage in Antigravity

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

- `query_local_llm`: Main tool for chat completions (supports `temperature`, `max_tokens`, etc.).
- `get_local_embeddings`: Convert strings into vector representations.
- `list_local_models`: List all loaded models (use `detailed: true` for full metadata).
- `load_local_model`: Tell LM Studio to load a specific model ID into memory.
- `unload_local_model`: Unload a model instance to free up VRAM.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
