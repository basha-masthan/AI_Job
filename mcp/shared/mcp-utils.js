import { readline } from 'readline';
import { RewardEngine, calculateDefaultReward } from './reward-engine.js';

let currentEngine = null;
let registeredTools = [];

export function createMcpServer(name, config = {}) {
  const engine = new RewardEngine(name, config);
  engine.load();
  currentEngine = engine;

  return {
    name,
    engine,

    registerTool(tool) {
      registeredTools.push(tool);
      return tool;
    },

    async handleRequest(request) {
      try {
        if (request.method === 'tools/list') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: registeredTools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema || { type: 'object', properties: {} }
              }))
            }
          };
        }

        if (request.method === 'tools/call') {
          const { name: toolName, arguments: args = {} } = request.params || {};
          const tool = registeredTools.find(t => t.name === toolName);
          if (!tool) {
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32601, message: `Tool '${toolName}' not found` }
            };
          }

          const actionId = `a_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const context = {
            source: args.source || args.company || '',
            query: args.query || args.role || args.jobTitle || ''
          };

          engine.recordAction(actionId, toolName, context);

          try {
            const result = await tool.handler(args, { engine, actionId });
            const reward = result._reward !== undefined ? result._reward : null;
            if (reward !== null) {
              engine.recordReward(actionId, reward, { toolName, ...context });
            }

            return {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result) }]
              }
            };
          } catch (err) {
            engine.recordReward(actionId, calculateDefaultReward('critical_failure'), { toolName, error: err.message });
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32603, message: err.message }
            };
          }
        }

        if (request.method === 'performance/get') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: engine.getPerformance()
          };
        }

        if (request.method === 'performance/suggestions') {
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: engine.suggestImprovements()
          };
        }

        if (request.method === 'weights/get') {
          const { key } = request.params || {};
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: key ? engine.getWeight(key) : engine.weights
          };
        }

        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: `Method '${request.method}' not found` }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32603, message: err.message }
        };
      }
    }
  };
}

export function startStdioServer(server) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

  process.stdin.setEncoding('utf-8');
  process.stdout.setEncoding('utf-8');
  process.stderr.setEncoding('utf-8');

  rl.on('line', async (line) => {
    line = line.trim();
    if (!line) return;

    try {
      const request = JSON.parse(line);
      const response = await server.handleRequest(request);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message}` }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });

  process.on('SIGINT', () => {
    server.engine?.save();
    process.exit(0);
  });

  process.on('uncaughtException', (err) => {
    console.error('[MCP Server] Uncaught exception:', err.message);
    server.engine?.save();
    process.exit(1);
  });
}

export function tool(name, description, inputSchema, handler) {
  return { name, description, inputSchema, handler };
}
