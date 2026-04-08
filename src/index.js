import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handlers to prevent bridge crashes (EOF)
const logFile = path.join(__dirname, "../bridge_debug.log");
async function logDebug(msg) {
  const timestamp = new Date().toISOString();
  await fs.appendFile(logFile, `[${timestamp}] ${msg}\n`).catch(() => {});
  console.error(msg);
}

process.on("uncaughtException", async (err) => {
  await logDebug(`[BRIDGE FATAL] Uncaught Exception: ${err.message}`);
  await logDebug(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  await logDebug(`[BRIDGE FATAL] Unhandled Rejection at: ${promise} reason: ${reason}`);
});

// Initialization
dotenv.config();

const LM_HOST = process.env.LM_HOST || "localhost";
const LM_PORT = process.env.LM_PORT || "1234";
const LM_BASE_URL = `http://${LM_HOST}:${LM_PORT}`;
const LM_API_TOKEN = process.env.LM_API_TOKEN || "";

const server = new Server(
  {
    name: "lmstudio-bridge",
    version: "1.7.0",
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
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_local_llm",
        description: "Standard: Query a local LLM for text generation. Supports Vision, JSON Schema, and Reasoning.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            systemPrompt: { type: "string", default: "You are a helpful assistant." },
            model: { type: "string", description: "Optional: Load or use specific model ID." },
            image_path: { type: "string", description: "Optional: Path to local image for Vision models." },
            json_mode: { type: "boolean", default: false },
            json_schema: { type: "object" },
            temperature: { type: "number", default: 0.7 },
            max_tokens: { type: "number", default: 4096 },
          },
          required: ["prompt"],
        },
      },
      {
        name: "query_local_llm_stateful",
        description: "Advanced: Stateful query using the /v1/responses endpoint. Supports reasoning control and follow-ups via previous_response_id.",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string", description: "The user prompt." },
            previous_response_id: { type: "string", description: "Optional: ID from a previous response to continue the conversation." },
            reasoning_effort: { type: "string", enum: ["low", "medium", "high"], description: "Optional: Control for reasoning models." },
            model: { type: "string" },
            max_tokens: { type: "number", default: 4096 },
          },
          required: ["input"],
        },
      },
      {
        name: "analyze_local_image",
        description: "Vision: Privacy-focused image analysis using local vision models (Llava, Moondream, etc).",
        inputSchema: {
          type: "object",
          properties: {
            image_path: { type: "string", description: "Absolute path to the image." },
            prompt: { type: "string", description: "What to ask about the image." },
            model: { type: "string" },
          },
          required: ["image_path", "prompt"],
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
        description: "Generate vector representations of text using a local model.",
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
        name: "get_system_health",
        description: "Check bridge machine and LM Studio host resource usage.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_local_models",
        description: "List loaded and available models.",
        inputSchema: { type: "object", properties: { detailed: { type: "boolean", default: false } } },
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
        name: "unload_local_model",
        description: "Unload a model instance to free up memory/VRAM.",
        inputSchema: {
          type: "object",
          properties: { model_id: { type: "string" } },
          required: ["model_id"],
        },
      },
      {
        name: "check_server_status",
        description: "Verify LM Studio API connection and health.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_files_in_directory",
        description: "List files in a specific local directory.",
        inputSchema: {
          type: "object",
          properties: { directory_path: { type: "string" } },
          required: ["directory_path"],
        },
      },
      {
        name: "read_file_content",
        description: "Directly read the content of a local file.",
        inputSchema: {
          type: "object",
          properties: { file_path: { type: "string" } },
          required: ["file_path"],
        },
      },
      {
        name: "analyze_local_image_async",
        description: "Async Vision: Start a background image analysis task. Returns a Task ID.",
        inputSchema: {
          type: "object",
          properties: {
            image_path: { type: "string" },
            prompt: { type: "string" },
            model: { type: "string" },
          },
          required: ["image_path", "prompt"],
        },
      },
      {
        name: "get_bridge_task_status",
        description: "Check the status and result of a background vision task.",
        inputSchema: {
          type: "object",
          properties: { task_id: { type: "string" } },
          required: ["task_id"],
        },
      },
      {
        name: "get_bridge_config",
        description: "Retrieve current bridge environment and network configuration.",
        inputSchema: { type: "object", properties: {} },
      }
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
        const { prompt, systemPrompt, temperature, max_tokens, model, image_path, json_mode, json_schema } = args;
        
        let messages = [
          { role: "system", content: systemPrompt || "You are a helpful assistant." }
        ];

        if (image_path) {
          const imgData = await fs.readFile(image_path);
          const ext = path.extname(image_path).slice(1).toLowerCase();
          const mimeType = ext === "jpg" ? "jpeg" : ext;
          const dataUrl = `data:image/${mimeType};base64,${imgData.toString("base64")}`;
          messages.push({
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          });
        } else {
          messages.push({ role: "user", content: prompt });
        }

        let targetModel = model;
        if (!targetModel) {
            const modelsRes = await fetch(`${LM_BASE_URL}/v1/models`, { headers: authHeaders });
            const modelsData = await modelsRes.json();
            if (modelsData.data && modelsData.data.length > 0) {
                targetModel = modelsData.data[0].id;
                await logDebug(`[BRIDGE] No model specified. Auto-selected: ${targetModel}`);
            }
        }

        const payload = {
          model: targetModel,
          messages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 4096,
          stream: false,
        };

        if (json_schema) {
          payload.response_format = { 
            type: "json_schema", 
            json_schema: {
              name: "mcp_output",
              strict: true,
              schema: json_schema
            }
          };
        } else if (json_mode) {
          payload.response_format = { 
            type: "json_schema",
            json_schema: {
              name: "json_fallback",
              schema: { type: "object", additionalProperties: true }
            }
          };
        }

        await logDebug(`[BRIDGE] Sending request to ${targetModel || 'default model'}...`);
        const response = await fetch(`${LM_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.error) throw new Error(JSON.stringify(result.error));
        const text = result.choices?.[0]?.message?.content || "";
        const attribution = `\n\n[Model: ${result.model}]`;
        return { content: [{ type: "text", text: text + attribution }] };
      }

      case "query_local_llm_stateful": {
        let { input, previous_response_id, reasoning_effort, model, max_tokens } = args;
        
        if (!model) {
            const modelsRes = await fetch(`${LM_BASE_URL}/v1/models`, { headers: authHeaders });
            const modelsData = await modelsRes.json();
            if (modelsData.data && modelsData.data.length > 0) {
                model = modelsData.data[0].id;
                await logDebug(`[BRIDGE] No model specified (stateful). Auto-selected: ${model}`);
            }
        }

        const payload = {
          model: model,
          input,
          previous_response_id,
          max_tokens: max_tokens || 4096,
          stream: false,
        };

        if (reasoning_effort) {
          payload.reasoning = { effort: reasoning_effort };
        }

        await logDebug(`[BRIDGE] Sending stateful request to ${model || 'default model'}...`);
        const response = await fetch(`${LM_BASE_URL}/v1/responses`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        await logDebug(`[BRIDGE] Stateful Response ID: ${result.id}`);
        
        if (result.error) throw new Error(JSON.stringify(result.error));
        
        // Extract text from the output. In /v1/responses, it usually comes in result.output array
        let text = "";
        if (result.output && Array.isArray(result.output)) {
          text = result.output
            .filter(o => o.type === "text")
            .map(o => o.text)
            .join("");
        } else if (result.choices?.[0]?.message?.content) {
          // Fallback if it behaves like chat completions
          text = result.choices[0].message.content;
        }

        return { 
          content: [
            { type: "text", text: text || "No text content returned." },
            { type: "text", text: `\n\n[Response ID: ${result.id}] [Model: ${result.model}]` }
          ] 
        };
      }

      case "analyze_local_image": {
        const { image_path, prompt, model } = args;
        const imgData = await fs.readFile(image_path);
        const dataUrl = `data:image/jpeg;base64,${imgData.toString("base64")}`;

        const response = await fetch(`${LM_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            model: model || undefined,
            messages: [
              { role: "user", content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } }
              ]}
            ]
          })
        });

        const result = await response.json();
        if (result.error) throw new Error(JSON.stringify(result.error));
        const text = result.choices?.[0]?.message?.content || "";
        const attribution = `\n\n[Model: ${result.model}]`;
        return { content: [{ type: "text", text: text + attribution }] };
      }

      case "query_local_file": {
        const { file_path, prompt } = args;
        const content = await fs.readFile(file_path, "utf-8");
        const response = await fetch(`${LM_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            messages: [
              { role: "system", content: "Analyze the following file content." },
              { role: "user", content: `File: ${file_path}\n\nContent:\n${content}\n\nQuestion: ${prompt}` }
            ]
          })
        });
        const result = await response.json();
        return { content: [{ type: "text", text: result.choices?.[0]?.message?.content || "" }] };
      }

      case "get_local_embeddings": {
        const response = await fetch(`${LM_BASE_URL}/v1/embeddings`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ input: args.input, model: args.model })
        });
        const result = await response.json();
        return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
      }

      case "search_local_docs": {
        const { directory_path, query, extension } = args;
        const files = await fs.readdir(directory_path);
        const filteredFiles = files.filter(f => f.endsWith(extension || ".md"));
        if (filteredFiles.length === 0) return { content: [{ type: "text", text: "No files found." }] };

        // 1. Get query embedding
        const qRes = await fetch(`${LM_BASE_URL}/v1/embeddings`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ input: query })
        });
        const qData = await qRes.json();
        const qVec = qData.data[0].embedding;

        let bestMatch = { score: -1, file: "", snippet: "" };
        for (const file of filteredFiles.slice(0, 10)) {
          const fullPath = path.join(directory_path, file);
          const text = await fs.readFile(fullPath, "utf-8");
          const fRes = await fetch(`${LM_BASE_URL}/v1/embeddings`, {
            method: "POST", headers: authHeaders, body: JSON.stringify({ input: text.slice(0, 1000) })
          });
          const fData = await fRes.json();
          const score = cosineSimilarity(qVec, fData.data[0].embedding);
          if (score > bestMatch.score) bestMatch = { score, file, snippet: text.slice(0, 300) };
        }
        return { content: [{ type: "text", text: `Top Match: ${bestMatch.file} (Score: ${bestMatch.score.toFixed(4)})\n\nSnippet: ${bestMatch.snippet}...` }] };
      }

      case "get_system_health": {
        const freeMem = os.freemem() / 1024 / 1024 / 1024;
        const totalMem = os.totalmem() / 1024 / 1024 / 1024;
        return { content: [{ type: "text", text: `Machine Memory: ${freeMem.toFixed(2)}GB free / ${totalMem.toFixed(2)}GB total\nCPUs: ${os.cpus().length}\nPlatform: ${os.platform()}` }] };
      }

      case "list_local_models": {
        const response = await fetch(`${LM_BASE_URL}/v1/models`, {
          method: "GET", headers: authHeaders
        });
        const result = await response.json();
        const text = args.detailed ? JSON.stringify(result.data, null, 2) : result.data.map(m => `- ${m.id}`).join("\n");
        return { content: [{ type: "text", text: text }] };
      }

      case "load_local_model": {
        const response = await fetch(`${LM_BASE_URL}/api/v1/models/load`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ model_id: args.model_id })
        });
        return { content: [{ type: "text", text: `Load request: ${response.statusText}` }] };
      }

      case "unload_local_model": {
        const response = await fetch(`${LM_BASE_URL}/api/v1/models/unload`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ model_id: args.model_id })
        });
        return { content: [{ type: "text", text: `Unload request: ${response.statusText}` }] };
      }

      case "check_server_status": {
        const response = await fetch(`${LM_BASE_URL}/v1/models`, { method: "GET", headers: authHeaders });
        return { content: [{ type: "text", text: response.ok ? "Connected to LM Studio" : "Connection failed" }] };
      }

      case "list_files_in_directory": {
        const files = await fs.readdir(args.directory_path);
        return { content: [{ type: "text", text: files.join("\n") }] };
      }

      case "read_file_content": {
        const content = await fs.readFile(args.file_path, "utf-8");
        return { content: [{ type: "text", text: content }] };
      }

      case "analyze_local_image_async": {
        const taskId = `task_${Date.now()}`;
        // Simple mock of async task for now
        return { content: [{ type: "text", text: `Task created: ${taskId}. Use get_bridge_task_status to check progress.` }] };
      }

      case "get_bridge_task_status": {
        return { content: [{ type: "text", text: "Task in progress or completed successfully (Async mock)." }] };
      }

      case "get_bridge_config": {
        return { content: [{ type: "text", text: `Host: ${LM_HOST}\nPort: ${LM_PORT}\nBase URL: ${LM_BASE_URL}\nAuth: ${LM_API_TOKEN ? 'Enabled' : 'None'}` }] };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  console.error("LM Studio Bridge 1.6.4.2 starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Bridge connected to Stdio.");
  
  // Keep alive for the MCP transport
  setInterval(() => {}, 1000 * 60 * 60);
}

main().catch(async (error) => {
  await logDebug("Fatal error in main: " + error.message);
  process.exit(1);
});
