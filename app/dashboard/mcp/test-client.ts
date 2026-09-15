import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  console.log("Starting MCP test client...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "mcp/server.ts"],
  });

  const client = new Client({
    name: "retailpilot-test-client",
    version: "1.0.0",
  });

  console.log("Connecting to MCP server...");

  await client.connect(transport);

  console.log("Connected to MCP server.");

  console.log("Calling get_low_stock_products...");

  const result = await client.callTool({
    name: "get_low_stock_products",
    arguments: {},
  });

  console.log("MCP Tool Result:");
  console.log(JSON.stringify(result, null, 2));

  await transport.close();

  console.log("MCP test completed.");
}

main().catch((error) => {
  console.error("MCP TEST ERROR:");
  console.error(error);
  process.exit(1);
});