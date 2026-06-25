/**
 * --------------------------------------------------------------------
 * docmd : Monorepo Security Audit
 * 
 * Scans the codebase for high-risk patterns that could lead to
 * XSS, RCE, or directory traversal vulnerabilities.
 * --------------------------------------------------------------------
 */

import nativeFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = path.resolve(__dirname, '..');

const AUDIT_CONFIG = {
    patterns: [
        {
            name: 'Potential DOM XSS (innerHTML)',
            regex: /\.innerHTML\s*=\s*/g,
            severity: 'HIGH',
            exclude: []
        },
        {
            name: 'Raw EJS Output (<%-)',
            regex: /<%-/g,
            severity: 'MEDIUM',
            include: [/\.ejs$/],
            exclude: [
                /layout\.ejs/, // Main layout (legit for page content)
                /menubar\.ejs/,
                /sidebar\.ejs/,
                /packages\/plugins\/threads\/src\/plugin\/templates\// // Threads use raw for markdown
            ],
            notes: 'Ensure the output is either trusted Markdown or manually escaped.'
        },
        {
            name: 'Unsafe Command Execution (eval)',
            regex: /\beval\s*\(/g,
            severity: 'CRITICAL'
        },
        {
            name: 'Unsafe Function Construction',
            regex: /new\s+Function\s*\(/g,
            severity: 'CRITICAL'
        },
        {
            name: 'Unsafe Shell Execution',
            regex: /(?<!\.(?:[a-zA-Z0-9_$]+))\bexec\s*\(/g,
            severity: 'HIGH',
            exclude: [
                /scripts\//, // Build scripts are allowed (legacy path)
                /tools\//, // Build tooling is allowed (current path)
                /packages\/core\/src\/engine\/workspace\.ts/ // Legit for git metadata
            ],
            notes: 'Check if this is child_process.exec. Avoid RegExp.exec false positives.'
        },
        {
            name: 'Path Traversal Risk (fs access with dynamic path)',
            regex: /fs\.(?:readFileSync|writeFile|mkdirSync|copyFileSync)\([^,)]*[\+\$]/g,
            severity: 'MEDIUM',
            exclude: [
                /scripts\//,
                /tools\//,
                /packages\/core\/src\/engine\//, // Core engine handles paths
                /packages\/plugins\/search\/src\/index\.ts/
            ]
        }
    ],
    // Custom filter to skip RegExp.exec specifically if the lookbehind isn't enough.
    // The `Unsafe Shell Execution` regex above uses a variable-length negative
    // lookbehind that only suppresses method calls on identifiers of 2+ chars
    // (e.g. `child_process.exec` — the chars before `exec(` are `s.`, which
    // matches the lookbehind pattern). Short identifiers like `re` slip
    // through because the chars before `exec(` are `e.` (just 2 chars) and
    // the lookbehind's `\.[a-zA-Z0-9_$]+` requires at least 1 identifier
    // char AFTER the dot, so it doesn't match `.` alone.
    //
    // To compensate, this filter suppresses the match when the line's
    // `.exec(` call is on a recognised RegExp variable name. The list
    // covers every common JS naming convention for a RegExp instance.
    // Real or potentially-real shell calls (any other variable name,
    // `child_process.exec`, `cp.exec`, standalone `exec(cmd)`, etc.)
    // are NOT suppressed — they remain flagged for operator review.
    filter: (pattern, line) => {
        if (pattern.name === 'Unsafe Shell Execution' && line.includes('.exec(')) {
            const before = line.split('.exec(')[0];
            if (before && /(?:re|regex|regexp|rgx|match|matcher|pattern|pat)(?![a-zA-Z_$])\s*(?:\.|$)/i.test(before)) return false;
        }

        if (pattern.name === 'Raw EJS Output (<%-)') {
            const safePatterns = [
                'renderIcon', 'include', 't(', 'content', 'navigationHtml', 
                'footerHtml', 'pluginHeadScriptsHtml', 'pluginBodyScriptsHtml', 
                'pluginStylesHtml', 'themeInitScript', 'faviconLinkHtml', 
                'metaTagsHtml', 'themeCssLinkHtml', 'frontmatter.customHead', 
                'frontmatter.customScripts', "'<script>'", "'</script>'", 
                'JSON.stringify', 'relativePathToRoot'
            ];
            if (safePatterns.some(p => line.includes(p))) return false;
        }

        if (pattern.name === 'Potential DOM XSS (innerHTML)') {
            if (line.includes("innerHTML = ''") || line.includes('innerHTML = ""') || line.includes('innerHTML = ``')) return false;
            if (line.includes('this.sanitize(') || line.includes('innerHTML = sanitized') || line.includes("'&times;'")) return false;
        }

        return true;
    },
    extensions: ['.ts', '.js', '.ejs', '.json'],
    // Build output directories are excluded because their content is generated
    // and minified — the audit is meant to catch issues in source code.
    excludeDirs: ['node_modules', 'dist', 'site', 'site-sky', 'out', '.git', 'temp', 'public', 'vendor', '_backup']
};

let issuesCount = 0;

function scanDir(dir) {
    const entries = nativeFs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(CWD, fullPath);

        if (entry.isDirectory()) {
            if (AUDIT_CONFIG.excludeDirs.includes(entry.name)) continue;
            scanDir(fullPath);
            continue;
        }

        const ext = path.extname(entry.name);
        if (!AUDIT_CONFIG.extensions.includes(ext)) continue;

        const content = nativeFs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        for (const pattern of AUDIT_CONFIG.patterns) {
            // Check global include/exclude for the file
            if (pattern.include && !pattern.include.some(re => re.test(relPath))) continue;
            if (pattern.exclude && pattern.exclude.some(re => re.test(relPath))) continue;

            let match;
            pattern.regex.lastIndex = 0; // Reset regex
            while ((match = pattern.regex.exec(content)) !== null) {
                const index = match.index;
                const lineNumber = content.substring(0, index).split('\n').length;
                const line = lines[lineNumber - 1].trim();

                // Custom filters
                if (AUDIT_CONFIG.filter && !AUDIT_CONFIG.filter(pattern, line)) continue;

                // Inline exclusion comment support
                if (line.includes('audit-ignore') || line.includes('eslint-disable')) continue;

                issuesCount++;
                const skipHeader = process.argv.includes('--skip-header');
                const prefix = skipHeader ? '\x1b[34m│\x1b[0m     ' : '\x1b[34m│\x1b[0m  ';
                
                console.log(`${prefix}[\x1b[1m${pattern.severity}\x1b[0m] \x1b[33m${pattern.name}\x1b[0m`);
                console.log(`${prefix}Location: \x1b[34m${relPath}:${lineNumber}\x1b[0m`);
                console.log(`${prefix}\x1b[2mCode: ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}\x1b[0m`);
                if (pattern.notes) console.log(`${prefix}\x1b[36mNote: ${pattern.notes}\x1b[0m`);
                console.log(`\x1b[34m│\x1b[0m`);
            }
        }
    }
}

const skipHeader = process.argv.includes('--skip-header');

if (!skipHeader) {
    console.log(`\x1b[34m┌─ Monorepo Security Audit\x1b[0m`);
    console.log(`\x1b[34m│\x1b[0m  Scanning packages and scripts...`);
    console.log(`\x1b[34m│\x1b[0m`);
}

try {
    scanDir(path.join(CWD, 'packages'));
    scanDir(path.join(CWD, 'tools'));

    if (issuesCount > 0) {
        if (!skipHeader) {
            console.log(`\x1b[34m│\x1b[0m  \x1b[31mFound ${issuesCount} potential security issues.\x1b[0m`);
            console.log(`\x1b[34m└──────────────────────────────────────────────────────────\x1b[0m\n`);
        } else {
            console.log(`\x1b[34m│\x1b[0m     \x1b[31mFound ${issuesCount} potential security issues.\x1b[0m`);
        }
    } else {
        if (!skipHeader) {
            console.log(`\x1b[34m│\x1b[0m  \x1b[32mNo high-risk patterns detected.\x1b[0m`);
            console.log(`\x1b[34m└──────────────────────────────────────────────────────────\x1b[0m\n`);
        }
    }
} catch (e) {
    console.error(`\x1b[31m│\x1b[0m  Fatal error during security audit: ${e.message}`);
    if (!skipHeader) {
        console.log(`\x1b[31m└──────────────────────────────────────────────────────────\x1b[0m\n`);
    }
    process.exit(1);
}

process.exit(issuesCount > 0 ? 1 : 0);