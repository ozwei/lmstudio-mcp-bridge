import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Configuration for LM Studio
const LM_HOST = "192.168.1.131";
const LM_PORT = "1234";
const LM_BASE_URL = `http://${LM_HOST}:${LM_PORT}`;
const LM_API_TOKEN = "sk-lm-OnWJx9dG:PnCBnM2zxKeVv8rGVf6l";

const server = new Server(
  {
    name: "lmstudio-bridge",
    version: "1.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Utility for Cosine Similarity (for search_local_docs)
 */
function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}
function magnitude(a) {
  return Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
}
function cosineSimilarity(a, b) {
  return dotProduct(a, b) / (magnitude(a) * magnitude(b));
}

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_local_llm",
        description: "Query a local LLM hosted on LM Studio for text generation.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            systemPrompt: { type: "string", default: "You are a helpful assistant." },
            temperature: { type: "number", default: 0.7 },
            max_tokens: { type: "number", default: 2048 },
            model: { type: "string" },
          },
          required: ["prompt"],
        },
      },
      {
        name: "query_local_file",
        description: "Privacy-First: Reads a local file and queries the local LLM about its contents.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Absolute path to the file." },
            prompt: { type: "string", description: "Your question about the file." },
          },
          required: ["file_path", "prompt"],
        },
      },
      {
        name: "search_local_docs",
        description: "Local RAG: Performs semantic search across a directory using local embeddings.",
        inputSchema: {
          type: "object",
          properties: {
            directory_path: { type: "string", description: "Directory to search." },
            query: { type: "string", description: "Search query." },
            extension: { type: "string", default: ".md", description: "Filter by extension." },
          },
          required: ["directory_path", "query"],
        },
      },
      {
        name: "get_local_embeddings",
        description: "Generate vector embeddings using a local model.",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string" },
            model: { type: "string" },
          },
          required: ["input"],
        },
      },
      {
        name: "load_local_model",
        description: "Load a specific model into LM Studio memory.",
        inputSchema: {
          type: "object",
          properties: { model_id: { type: "string" } },
          required: ["model_id"],
        },
      },
      {
        name: "get_system_health",
        description: "Check local system resource usage (CPU/Memory).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_local_models",
        description: "List loaded and available models.",
        inputSchema: {
          type: "object",
          properties: { detailed: { type: "boolean", default: false } },
        },
      },
    ],
  };
});

// Implement tool logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const authHeaders = {
    Authorization: `Bearer ${LM_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  try {
    switch (name) {
      case "query_local_llm": {
        const { prompt, systemPrompt, temperature, max_tokens, model } = args;
        const response = await axios.post(`${LM_BASE_URL}/v1/chat/completions`, {
          model: model || undefined,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens,
        }, { headers: authHeaders });
        return { content: [{ type: "text", text: response.data.choices[0].message.content }] };
      }

      case "query_local_file": {
        const { file_path, prompt } = args;
        const content = await fs.readFile(file_path, "utf-8");
        const response = await axios.post(`${LM_BASE_URL}/v1/chat/completions`, {
          messages: [
            { role: "system", content: "Analyze the provided file content carefully." },
            { role: "user", content: `File Content:\n${content}\n\nQuestion: ${prompt}` },
          ],
        }, { headers: authHeaders });
        return { content: [{ type: "text", text: response.data.choices[0].message.content }] };
      }

      case "get_local_embeddings": {
        const response = await axios.post(`${LM_BASE_URL}/v1/embeddings`, {
          input: args.input,
          model: args.model,
        }, { headers: authHeaders });
        return { content: [{ type: "text", text: JSON.stringify(response.data.data, null, 2) }] };
      }

      case "search_local_docs": {
        const { directory_path, query, extension } = args;
        const files = await fs.readdir(directory_path);
        const filteredFiles = files.filter(f => f.endsWith(extension));

        if (filteredFiles.length === 0) return { content: [{ type: "text", text: "No matching files found." }] };

        // 1. Get query embedding
        const qRes = await axios.post(`${LM_BASE_URL}/v1/embeddings`, { input: query }, { headers: authHeaders });
        const qVec = qRes.data.data[0].embedding;

        let bestMatch = { score: -1, file: "", snippet: "" };

        // 2. Scan and find best (Simplified: first 5 files only for performance)
        for (const file of filteredFiles.slice(0, 5)) {
          const fullPath = path.join(directory_path, file);
          const text = await fs.readFile(fullPath, "utf-8");
          const fRes = await axios.post(`${LM_BASE_URL}/v1/embeddings`, { input: text.slice(0, 1000) }, { headers: authHeaders });
          const fVec = fRes.data.data[0].embedding;
          const score = cosineSimilarity(qVec, fVec);
          
          if (score > bestMatch.score) {
            bestMatch = { score, file, snippet: text.slice(0, 300) };
          }
        }

        return { content: [{ type: "text", text: `Top Match: ${bestMatch.file} (Score: ${bestMatch.score.toFixed(4)})\n\nSnippet: ${bestMatch.snippet}...` }] };
      }

      case "get_system_health": {
        const freeMem = os.freemem() / 1024 / 1024 / 1024;
        const totalMem = os.totalmem() / 1024 / 1024 / 1024;
        return { content: [{ type: "text", text: `Memory: ${freeMem.toFixed(2)}GB free / ${totalMem.toFixed(2)}GB total\nCPUs: ${os.cpus().length}\nPlatform: ${os.platform()}` }] };
      }

      case "list_local_models": {
        const response = await axios.get(`${LM_BASE_URL}/v1/models`, { headers: authHeaders });
        const content = args.detailed ? JSON.stringify(response.data.data, null, 2) : response.data.data.map(m => m.id).join("\n");
        return { content: [{ type: "text", text: content }] };
      }

      case "load_local_model": {
        const response = await axios.post(`${LM_BASE_URL}/api/v1/models/load`, { model_id: args.model_id }, { headers: authHeaders });
        return { content: [{ type: "text", text: `Load request status: ${response.statusText}` }] };
      }

      case "unload_local_model": {
        const response = await axios.post(`${LM_BASE_URL}/api/v1/models/unload`, { model_id: args.model_id }, { headers: authHeaders });
        return { content: [{ type: "text", text: `Unload request status: ${response.statusText}` }] };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
    return { content: [{ type: "text", text: `Error: ${errorMsg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Bridge 1.2.0 starting...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
