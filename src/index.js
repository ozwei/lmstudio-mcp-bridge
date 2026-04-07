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
    version: "1.6.5",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_local_llm",
        description: "Standard: Query a local LLM for text generation. Supports JSON Schema.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            systemPrompt: { type: "string", default: "You are a helpful assistant." },
            model: { type: "string" },
            json_mode: { type: "boolean", default: false },
            json_schema: { type: "object" },
            temperature: { type: "number", default: 0.7 },
            max_tokens: { type: "number", default: 2048 },
          },
          required: ["prompt"],
        },
      },
      {
        name: "list_local_models",
        description: "List loaded and available models.",
        inputSchema: { type: "object", properties: { detailed: { type: "boolean", default: false } } },
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
        const { prompt, systemPrompt, temperature, max_tokens, model, json_mode, json_schema } = args;
        
        const payload = {
          model: model || undefined,
          messages: [
             { role: "system", content: systemPrompt || "You are a helpful assistant." },
             { role: "user", content: prompt }
          ],
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 2048,
          stream: false,
        };

        if (json_schema) {
           payload.response_format = { 
             type: "json_schema", 
             json_schema: {
               name: "mcp_structured_output",
               strict: true,
               schema: json_schema
             }
           };
        } else if (json_mode) {
           // Fallback to a generic schema if LM Studio rejects json_object
           payload.response_format = { 
             type: "json_schema",
             json_schema: {
               name: "json_object_fallback",
               strict: false,
               schema: { type: "object", additionalProperties: true }
             }
           };
        }

        await logDebug(`[BRIDGE] Sending request to ${model || 'default model'}...`);

        const response = await fetch(`${LM_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload)
        }).catch(err => {
          throw new Error(`Inference Fetch Failed: ${err.message}`);
        });
        
        await logDebug(`[BRIDGE] Response received with status: ${response.status}`);
        const result = await response.json();
        
        if (result.error) {
          return { content: [{ type: "text", text: `LM Studio Error: ${JSON.stringify(result.error)}` }], isError: true };
        }

        const responseText = result.choices?.[0]?.message?.content || "No message content returned.";
        return { content: [{ type: "text", text: responseText }] };
      }

      case "list_local_models": {
        const response = await fetch(`${LM_BASE_URL}/v1/models`, {
          method: "GET",
          headers: authHeaders
        });
        const result = await response.json();
        const data = result.data || [];
        const content = data.length > 0 ? data.map(m => `- ${m.id}`).join("\n") : "No models found.";
        return { content: [{ type: "text", text: content }] };
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
