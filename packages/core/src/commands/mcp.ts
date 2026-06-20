/**
 * --------------------------------------------------------------------
 * docmd : the zero-config documentation engine.
 *
 * @package     @docmd/core (and ecosystem)
 * @website     https://docmd.io
 * @repository  https://github.com/docmd-io/docmd
 * @license     MIT
 * @copyright   Copyright (c) 2025-present docmd.io
 *
 * [docmd-source] - Please do not remove this header.
 * --------------------------------------------------------------------
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { buildSite } from './build.js';
import { loadConfig } from '../utils/config-loader.js';

const pkgUrl = new URL('../../package.json', import.meta.url);
const { version } = JSON.parse(fs.readFileSync(pkgUrl, 'utf-8'));

// Helpers to find and search markdown files
function findMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (file !== 'node_modules' && !file.startsWith('.')) {
          results.push(...findMarkdownFiles(fullPath));
        }
      } else if (file.endsWith('.md') || file.endsWith('.markdown')) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore filesystem errors */ }
  return results;
}

export function validateLinks(docsDir: string): { file: string; line: number; link: string; error: string }[] {
  const errors: { file: string; line: number; link: string; error: string }[] = [];
  if (!fs.existsSync(docsDir)) return errors;

  const mdFiles = findMarkdownFiles(docsDir);

  for (const filePath of mdFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const relativeFile = path.relative(process.cwd(), filePath);

      lines.forEach((lineText, lineIdx) => {
        const lineNum = lineIdx + 1;
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(lineText)) !== null) {
          const linkTarget = match[2].trim().split('#')[0]; // strip anchors
          if (!linkTarget) continue;

          // Skip external, anchors, mailto, etc.
          if (
            linkTarget.startsWith('http://') ||
            linkTarget.startsWith('https://') ||
            linkTarget.startsWith('mailto:') ||
            linkTarget.startsWith('tel:') ||
            linkTarget.startsWith('#')
          ) {
            continue;
          }

          // Resolve link relative to file's directory
          let resolvedPath = '';
          if (linkTarget.startsWith('/')) {
            resolvedPath = path.join(docsDir, linkTarget);
          } else {
            resolvedPath = path.resolve(path.dirname(filePath), linkTarget);
          }

          const exists =
            fs.existsSync(resolvedPath) ||
            fs.existsSync(resolvedPath + '.md') ||
            fs.existsSync(resolvedPath + '.markdown') ||
            fs.existsSync(path.join(resolvedPath, 'index.md')) ||
            fs.existsSync(path.join(resolvedPath, 'index.markdown'));

          if (!exists) {
            errors.push({
              file: relativeFile,
              line: lineNum,
              link: linkTarget,
              error: `Broken link: target resolved to ${path.relative(process.cwd(), resolvedPath)} does not exist`
            });
          }
        }
      });
    } catch { /* ignore read errors */ }
  }

  return errors;
}

export async function runMcpServer() {
  console.error("docmd MCP server starting...");

  const rl = readline.createInterface({
    input: process.stdin,
    output: undefined,
    terminal: false
  });

  const sendResponse = (id: any, result: any) => {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
  };

  const sendError = (id: any, code: number, message: string, data?: any) => {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } }) + "\n");
  };

  rl.on('line', async (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      if (message.jsonrpc !== "2.0") {
        sendError(message.id || null, -32600, "Invalid Request");
        return;
      }

      const { method, params, id } = message;

      if (method === "initialize") {
        sendResponse(id, {
          protocolVersion: "2025-03-26",
          capabilities: {
            resources: {},
            tools: {},
            prompts: {}
          },
          serverInfo: {
            name: "docmd-mcp-server",
            version
          }
        });
        return;
      }

      if (method === "notifications/initialized" || method === "initialized") {
        // Notification, no response needed
        return;
      }

      if (method === "ping") {
        sendResponse(id, {});
        return;
      }

      // Handle Tools Listing
      if (method === "tools/list") {
        sendResponse(id, {
          tools: [
            {
              name: "search_docs",
              description: "Search the documentation content for a specific query.",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "The term or phrase to search for." }
                },
                required: ["query"]
              }
            },
            {
              name: "read_doc",
              description: "Read the raw markdown content of a documentation file.",
              inputSchema: {
                type: "object",
                properties: {
                  route: { type: "string", description: "Relative path to the markdown file from root (e.g. docs/getting-started.md)." }
                },
                required: ["route"]
              }
            },
            {
              name: "validate_docs",
              description: "Validates and lints all local markdown links to detect broken paths.",
              inputSchema: {
                type: "object",
                properties: {}
              }
            },
            {
              name: "get_llms_context",
              description: "Retrieve the unified prompt context of the entire documentation site (llms.txt content).",
              inputSchema: {
                type: "object",
                properties: {}
              }
            }
          ]
        });
        return;
      }

      // Handle Resources Listing
      if (method === "resources/list") {
        sendResponse(id, {
          resources: [
            {
              uri: "docmd://context/llms.txt",
              name: "llms.txt Context",
              mimeType: "text/plain",
              description: "Unified text context containing the entire documentation site"
            },
            {
              uri: "docmd://context/skill",
              name: "Agent SKILL.md",
              mimeType: "text/markdown",
              description: "Instruction manual and skills reference for docmd"
            }
          ]
        });
        return;
      }

      // Handle Resources Read
      if (method === "resources/read") {
        const { uri } = params || {};
        if (!uri) {
          sendResponse(id, { content: [{ type: "text", text: "Error: URI parameter is required." }] });
          return;
        }

        let config: any;
        try {
          config = await loadConfig('docmd.config.js', { quiet: true });
        } catch {
          config = { src: 'docs', out: 'site' };
        }

        if (uri === "docmd://context/llms.txt") {
          const llmsFullFile = path.resolve(process.cwd(), config.out || 'site', 'llms-full.txt');
          if (fs.existsSync(llmsFullFile)) {
            try {
              const fullContext = fs.readFileSync(llmsFullFile, 'utf8');
              sendResponse(id, {
                contents: [{
                  uri,
                  mimeType: "text/plain",
                  text: fullContext
                }]
              });
            } catch (err: any) {
              sendResponse(id, { content: [{ type: "text", text: `Error reading context file: ${err.message}` }] });
            }
          } else {
            sendResponse(id, { content: [{ type: "text", text: "Error: llms-full.txt context file has not been generated." }] });
          }
          return;
        }

        if (uri === "docmd://context/skill") {
          const skillFile = path.resolve(process.cwd(), 'SKILL.md');
          let content = '';
          if (fs.existsSync(skillFile)) {
            try {
              content = fs.readFileSync(skillFile, 'utf8');
            } catch (err: any) {
              sendResponse(id, { content: [{ type: "text", text: `Error reading SKILL.md: ${err.message}` }] });
              return;
            }
          } else {
            content = [
              "---",
              "name: docmd",
              "description: Fallback agent instruction set for docmd.",
              "skills: https://github.com/docmd-io/docmd-skills",
              "docs: https://docs.docmd.io",
              "llms-context: https://docs.docmd.io/llms-full.txt",
              "---",
              "",
              "# docmd Agent Skills",
              "",
              "This project uses **docmd**, the zero-config AI-first documentation engine.",
              "",
              "## Agent Instructions & Skills Reference",
              "The authoritative prompt library and instruction set for docmd is maintained in the official repository:",
              "👉 **[github.com/docmd-io/docmd-skills](https://github.com/docmd-io/docmd-skills)**",
              "",
              "To fetch specific skills, you can reference the modules at `docmd-skills`:",
              "- **CLI / Config / Plugins**: For configuration rules, commands, and plugin setup.",
              "- **Formatting / Syntax**: For Callouts, tabs, steps, grids, and URL embeds.",
              "- **API**: MCP integrations, client-side events, and live editor.",
              "",
              "### Local Customisation",
              "To create a customized instruction set for this specific workspace, create a `SKILL.md` file in the root of your project."
            ].join('\n');
          }

          sendResponse(id, {
            contents: [{
              uri,
              mimeType: "text/markdown",
              text: content
            }]
          });
          return;
        }

        sendError(id, -32602, `Resource not found: ${uri}`);
        return;
      }

      // Handle Tools Execution
      if (method === "tools/call") {
        const { name, arguments: args } = params;

        // Resolve workspace parameters
        let config: any;
        try {
          config = await loadConfig('docmd.config.js', { quiet: true });
        } catch {
          // Fallback zero config
          config = { src: 'docs', out: 'site' };
        }
        const docsDir = path.resolve(process.cwd(), config.src || 'docs');

        if (name === "search_docs") {
          const query = (args?.query || "").toLowerCase();
          if (!query) {
            sendResponse(id, { content: [{ type: "text", text: "Error: Query parameter is required." }] });
            return;
          }

          if (!fs.existsSync(docsDir)) {
            sendResponse(id, { content: [{ type: "text", text: `Error: Source directory "${docsDir}" does not exist.` }] });
            return;
          }

          const mdFiles = findMarkdownFiles(docsDir);
          const matches: string[] = [];

          for (const filePath of mdFiles) {
            try {
              const fileContent = fs.readFileSync(filePath, 'utf8');
              const lines = fileContent.split('\n');
              const fileRelPath = path.relative(process.cwd(), filePath);
              let foundInFile = false;

              lines.forEach((lineText, idx) => {
                if (lineText.toLowerCase().includes(query)) {
                  if (!foundInFile) {
                    matches.push(`\n### File: ${fileRelPath}`);
                    foundInFile = true;
                  }
                  matches.push(`Line ${idx + 1}: ${lineText.trim()}`);
                }
              });
            } catch { /* ignore file errors */ }
          }

          const textResult = matches.length > 0 
            ? `Found search matches:\n${matches.join('\n')}`
            : `No matches found for query: "${query}"`;

          sendResponse(id, { content: [{ type: "text", text: textResult }] });
          return;
        }

        if (name === "read_doc") {
          const route = args?.route || "";
          if (!route) {
            sendResponse(id, { content: [{ type: "text", text: "Error: Route is required." }] });
            return;
          }

          const resolvedFilePath = path.resolve(process.cwd(), route);
          if (!fs.existsSync(resolvedFilePath)) {
            sendResponse(id, { content: [{ type: "text", text: `Error: File not found at path "${route}".` }] });
            return;
          }

          try {
            const rawContent = fs.readFileSync(resolvedFilePath, 'utf8');
            sendResponse(id, { content: [{ type: "text", text: rawContent }] });
          } catch (err: any) {
            sendResponse(id, { content: [{ type: "text", text: `Error reading file: ${err.message}` }] });
          }
          return;
        }

        if (name === "validate_docs") {
          const errors = validateLinks(docsDir);
          if (errors.length === 0) {
            sendResponse(id, { content: [{ type: "text", text: "Documentation links validated successfully! No broken links found." }] });
          } else {
            const errorReport = errors.map(e => `[${e.file}:${e.line}] -> ${e.link} (${e.error})`).join('\n');
            sendResponse(id, { content: [{ type: "text", text: `Validation errors found:\n${errorReport}` }] });
          }
          return;
        }

        if (name === "get_llms_context") {
          // Trigger build to ensure context is up to date
          try {
            console.error("Building site context...");
            await buildSite('docmd.config.js', { quiet: true, isDev: false });
          } catch (err: any) {
            console.error(`Build warning: ${err.message}`);
          }

          const llmsFullFile = path.resolve(process.cwd(), config.out || 'site', 'llms-full.txt');
          if (fs.existsSync(llmsFullFile)) {
            try {
              const fullContext = fs.readFileSync(llmsFullFile, 'utf8');
              sendResponse(id, { content: [{ type: "text", text: fullContext }] });
            } catch (err: any) {
              sendResponse(id, { content: [{ type: "text", text: `Error reading context file: ${err.message}` }] });
            }
          } else {
            sendResponse(id, { content: [{ type: "text", text: "Error: llms-full.txt context file has not been generated. Please make sure the build finishes successfully." }] });
          }
          return;
        }

        sendError(id, -32601, `Method not found: ${name}`);
        return;
      }

      sendError(id, -32601, `Method not found: ${method}`);
    } catch (err: any) {
      sendError(null, -32700, `Parse error: ${err.message}`);
    }
  });
}