// eslint-rules/no-unsafe-fs-read.js
// Flags fs.* file calls whose path argument was not resolved through
// safePath(root, ...). See DEVELOPMENT-BENCHMARK.md S1 (CWE-22).

const TARGET_METHODS = new Set([
  'readFile', 'readFileSync',
  'writeFile', 'writeFileSync',
  'appendFile', 'appendFileSync',
  'unlink', 'unlinkSync',
  'stat', 'statSync',
  'lstat', 'lstatSync',
  'readdir', 'readdirSync',
  'mkdir', 'mkdirSync',
  'rmdir', 'rmdirSync',
  'access', 'accessSync'
]);

const FS_ROOT_NAMES = new Set(['fs', 'fsPromises', 'nodeFs', 'nodefs', 'fsp']);

function getFsMethod(node) {
  if (node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return null;
  const prop = callee.property;
  if (prop.type !== 'Identifier') return null;
  if (!TARGET_METHODS.has(prop.name)) return null;
  // Only flag when the root object of the call chain is a known fs import.
  // Wrappers like ctx.readFile(...) and sourceTools.readFile(...) are NOT flagged
  // because they typically perform their own safePath() validation internally.
  let obj = callee.object;
  while (obj && obj.type === 'MemberExpression' && !obj.computed) {
    obj = obj.object;
  }
  if (!obj || obj.type !== 'Identifier') return null;
  if (!FS_ROOT_NAMES.has(obj.name)) return null;
  return prop.name;
}

function isSafeExpr(node, safeNames) {
  if (!node) return false;
  if (node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'safePath') {
    return true;
  }
  if (node.type === 'Identifier') {
    return safeNames.has(node.name);
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow fs.* file calls whose path argument was not resolved through safePath(root, ...).'
    },
    schema: [],
    messages: {
      unsafe: 'fs.{{ method }}() path argument must be resolved via safePath(projectRoot, userPath). CWE-22 path traversal prevention — see DEVELOPMENT-BENCHMARK.md S1.'
    }
  },

  create(context) {
    const safeNames = new Set();

    function trackSafePathReturn(node) {
      if (!node.init) return;
      const init = node.init;
      if (init.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === 'safePath' &&
          node.id.type === 'Identifier') {
        safeNames.add(node.id.name);
      }
    }

    return {
      VariableDeclarator: trackSafePathReturn,
      CallExpression(node) {
        const method = getFsMethod(node);
        if (!method) return;
        const firstArg = node.arguments[0];
        if (isSafeExpr(firstArg, safeNames)) return;
        context.report({ node, messageId: 'unsafe', data: { method } });
      }
    };
  }
};