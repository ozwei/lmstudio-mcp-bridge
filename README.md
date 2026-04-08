# LM Studio MCP Bridge

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

# LM Studio MCP Bridge

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

A Node.js based Model Context Protocol (MCP) bridge that enables **Antigravity** (and other MCP clients) to interact with locally hosted Large Language Models (LLMs) via **LM Studio**.

## Overview

This bridge acts as a translation layer between the MCP standard and LM Studio's OpenAI-compatible and native administrative APIs. It allows AI assistants to autonomously query, load, and manage local models running on your hardware.

## Features

- 💬 **Dynamic Chat & Vision**: Query local LLMs with text and images. Supports structured JSON output and reasoning.
- 📂 **Privacy-First RAG**: Semantic search across local directories using local embeddings.
- 📑 **Direct File Interaction**: Read, analyze, and query local files directly.
- 🏗️ **Model Orchestration**: Programmatically load and unload models to manage hardware resources.
- ⚡ **Async Processing**: Offload long-running vision tasks to the background.
- 🏥 **System Monitoring**: Check CPU/Memory health and bridge configuration.

---

## Available Tools (v1.7.0)

The bridge provides a comprehensive suite of **15 tools** categorized for various AI workflows:

### 🗨️ Core Interaction
- `query_local_llm`: Standard text generation. Supports `image_path`, `json_mode`, and `json_schema`.
- `analyze_local_image`: Direct image analysis using local vision models.
- `analyze_local_image_async`: Start background image analysis (returns a Task ID).
- `get_bridge_task_status`: Check progress of asynchronous vision tasks.

### 📁 File & Knowledge (RAG)
- `search_local_docs`: Semantic vector search across local document directories.
- `get_local_embeddings`: Generate text embeddings for local indexing.
- `query_local_file`: Read a file and ask questions about its specific content.
- `list_files_in_directory`: Browse local file systems.
- `read_file_content`: Fetch raw content from local files.

### 🤖 Model Management
- `list_local_models`: See all loaded and available models (optionally detailed).
- `load_local_model`: Load a specific model ID into memory/VRAM.
- `unload_local_model`: Free up resources by unloading models.

### 🛠️ System & Debugging
- `get_system_health`: Monitor bridge machine CPU and Memory usage.
- `check_server_status`: Verify connection to the LM Studio API.
- `get_bridge_config`: View current host, port, and authentication settings.

---

## Usage Examples

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

### 🖼️ Vision Analysis
Analyze a local screenshot or diagram.
```json
{
  "prompt": "What is shown in this architecture diagram?",
  "image_path": "C:/Users/otwo/Desktop/system_init.png"
}
```

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

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
