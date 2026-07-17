// eslint-rules/require-verify-client.js
// Requires every new WebSocketServer({...}) to include a verifyClient
// callback. See DEVELOPMENT-BENCHMARK.md S3 (CWE-1385).

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require WebSocketServer({...}) to include a verifyClient callback that validates the Origin header.'
    },
    schema: [],
    messages: {
      missing: 'new WebSocketServer({...}) must include a verifyClient callback that validates the Origin header. CWE-1385 (CSWSH) prevention — see DEVELOPMENT-BENCHMARK.md S3.'
    }
  },

  create(context) {
    function hasVerifyClient(objExpr) {
      return objExpr.properties.some((p) => (
        p.type === 'Property' &&
        !p.computed &&
        p.key.type === 'Identifier' &&
        p.key.name === 'verifyClient'
      ));
    }

    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name !== 'WebSocketServer') return;
        if (node.arguments.length === 0) {
          context.report({ node, messageId: 'missing' });
          return;
        }
        const arg = node.arguments[0];
        if (arg.type !== 'ObjectExpression') return;
        if (!hasVerifyClient(arg)) {
          context.report({ node, messageId: 'missing' });
        }
      }
    };
  }
};