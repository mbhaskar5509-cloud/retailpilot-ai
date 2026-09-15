import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("Starting MCP test client...");

  const client = new Client({
    name: "retailpilot-ai-test-client",
    version: "1.0.0",
  });

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
  });

  console.log("Connecting to MCP server...");

  await client.connect(transport);

  console.log("Connected to MCP server.");
  console.log("");

  const tools = [
    "get_low_stock_products",
    "get_dead_stock",
    "get_profitability",
    "get_supplier_outstanding",
    "generate_business_report",
  ];

  for (const toolName of tools) {
    console.log("========================================");
    console.log(`Calling ${toolName}...`);
    console.log("========================================");

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: {},
      });

      console.log("MCP Tool Result:");
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Error calling ${toolName}:`);
      console.error(error);
    }

    console.log("");
  }

  console.log("All MCP tools tested.");
  await client.close();
}

main().catch((error) => {
  console.error("MCP TEST CLIENT ERROR:");
  console.error(error);
  process.exit(1);
});