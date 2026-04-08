import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// Configuration for LM Studio
const LM_HOST = "192.168.1.131";
const LM_PORT = "1234";
const LM_BASE_URL = `http://${LM_HOST}:${LM_PORT}`;
const LM_API_TOKEN = "sk-lm-OnWJx9dG:PnCBnM2zxKeVv8rGVf6l";

const server = new Server(
  {
    name: "lmstudio-bridge",
    version: "1.1.0",
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
        description: "Query a local LLM hosted on LM Studio for text generation.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The main text prompt to send to the local model.",
            },
            systemPrompt: {
              type: "string",
              description: "Optional instruction to set model behavior.",
              default: "You are a helpful assistant.",
            },
            temperature: {
              type: "number",
              description: "Sampling temperature (0.0 to 1.0).",
              default: 0.7,
            },
            max_tokens: {
              type: "number",
              description: "Upper limit on the number of generated tokens.",
              default: 2048,
            },
            model: {
              type: "string",
              description: "Specific model ID to use (if multiple are loaded).",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "get_local_embeddings",
        description: "Convert text to vector embeddings using a local embedding model.",
        inputSchema: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "The text string to embed.",
            },
            model: {
              type: "string",
              description: "Embedding model ID (defaults to first available if not specified).",
            },
          },
          required: ["input"],
        },
      },
      {
        name: "list_local_models",
        description: "List all loaded and available models in LM Studio.",
        inputSchema: {
          type: "object",
          properties: {
            detailed: {
              type: "boolean",
              description: "Whether to return full technical details for each model.",
              default: false,
            },
          },
        },
      },
      {
        name: "load_local_model",
        description: "Request LM Studio to load a specific model into memory.",
        inputSchema: {
          type: "object",
          properties: {
            model_id: {
              type: "string",
              description: "The identifier of the model to load.",
            },
          },
          required: ["model_id"],
        },
      },
      {
        name: "unload_local_model",
        description: "Request LM Studio to unload a specific model from memory.",
        inputSchema: {
          type: "object",
          properties: {
            model_id: {
              type: "string",
              description: "The identifier (or instance ID) of the model to unload.",
            },
          },
          required: ["model_id"],
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
            { role: "system", content: systemPrompt || "You are a helpful assistant." },
            { role: "user", content: prompt },
          ],
          temperature: temperature ?? 0.7,
          max_tokens: max_tokens ?? 2048,
        }, { headers: authHeaders });

        return {
          content: [{ type: "text", text: response.data.choices[0].message.content }],
        };
      }

      case "get_local_embeddings": {
        const { input, model } = args;
        const response = await axios.post(`${LM_BASE_URL}/v1/embeddings`, {
          input,
          model: model || undefined,
        }, { headers: authHeaders });

        return {
          content: [{ type: "text", text: JSON.stringify(response.data.data, null, 2) }],
        };
      }

      case "list_local_models": {
        const { detailed } = args;
        const response = await axios.get(`${LM_BASE_URL}/v1/models`, { headers: authHeaders });
        
        if (detailed) {
          return {
            content: [{ type: "text", text: JSON.stringify(response.data.data, null, 2) }],
          };
        } else {
          const modelList = response.data.data.map(m => `- ${m.id}`).join("\n");
          return {
            content: [{ type: "text", text: `Loaded models in LM Studio:\n${modelList}` }],
          };
        }
      }

      case "load_local_model": {
        const { model_id } = args;
        const response = await axios.post(`${LM_BASE_URL}/api/v1/models/load`, {
          model_id,
        }, { headers: authHeaders });

        return {
          content: [{ type: "text", text: `Model '${model_id}' load request sent. Status: ${response.statusText}` }],
        };
      }

      case "unload_local_model": {
        const { model_id } = args;
        const response = await axios.post(`${LM_BASE_URL}/api/v1/models/unload`, {
          model_id,
        }, { headers: authHeaders });

        return {
          content: [{ type: "text", text: `Model '${model_id}' unload request sent. Status: ${response.statusText}` }],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error) {
    const errorMsg = error.response && error.response.data ? JSON.stringify(error.response.data, null, 2) : error.message;
    return {
      content: [{ type: "text", text: `Error calling LM Studio [${name}]: ${errorMsg}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM Studio Expanded Bridge MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
