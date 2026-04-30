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

import { execSync } from 'child_process';
import { TUI } from '@docmd/api';

/**
 * find and kill running docmd processes
 * If port is provided, only kill the process listening on that port.
 * If force is true, also kill serve processes on common docmd ports.
 */
export async function stopServer(port: any, force: boolean = false) {
    // Common ports used by docmd dev server
    const commonPorts = [3000, 3001, 8080, 8081];

    if (port) {
        TUI.section(`Stopping port ${port}`);
        try {
            // Try lsof first
            let pid = '';
            try {
                pid = execSync(`lsof -t -i:${port}`).toString().trim();
            } catch {
                // Fallback to fuser if lsof fails
                try {
                    pid = execSync(`fuser -k ${port}/tcp 2>/dev/null`).toString().trim();
                } catch {
                    // Fallback to netstat
                    const netstat = execSync(`netstat -anp tcp 2>/dev/null | grep LISTEN | grep ${port}`).toString();
                    const match = netstat.match(/(\d+)\/\w+/);
                    if (match) pid = match[1];
                }
            }
            if (pid) {
                TUI.step(`Found process ${pid} on port ${port}`, 'WAIT');
                try {
                    process.kill(Number(pid), 'SIGTERM');
                } catch {
                    process.kill(Number(pid), 'SIGKILL');
                }
                TUI.footer();
                TUI.success(`Docmd instance on port ${port} has been stopped.`);
                return;
            }
        } catch {
            // No process found
        }
        TUI.step(`No instance found on port ${port}`, 'SKIP');
        TUI.footer();
        return;
    }

    TUI.section('Stopping all instances');

    try {
        // Get all processes with PIDs and full command lines
        // We filter for docmd but exclude the grep itself and the current process
        const currentPid = process.pid;

        // Use ps to list processes. -ax to see all, -o pid,command for details.
        const output = execSync('ps -ax -o pid,command').toString();
        const lines = output.split('\n');

        const targets = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const [pidStr, ...cmdParts] = trimmed.split(/\s+/);
            const pid = parseInt(pidStr, 10);
            const command = cmdParts.join(' ');

            // Check if it's a docmd process (dev or live) but not the current one
            // We look for 'docmd dev', 'docmd live', or direct bin/docmd.js execution
            const isDocmd = command.includes('docmd dev') ||
                command.includes('docmd live') ||
                command.includes('bin/docmd.js');

            // With --force, also detect 'serve' processes on common docmd ports
            let isServe = false;
            if (force) {
                isServe = (command.includes('serve ') || command.includes('serve -p')) &&
                    commonPorts.some(p => command.includes(`-p ${p}`) || command.includes(`--port ${p}`));
            }

            const isNotCurrent = pid !== currentPid && command.indexOf('stop') === -1;

            if ((isDocmd || isServe) && isNotCurrent) {
                targets.push({ pid, command, type: isServe ? 'serve' : 'docmd' });
            }
        }

        if (targets.length === 0) {
            TUI.step('No running docmd instances found', 'SKIP');
            TUI.footer();
            return;
        }

        for (const target of targets) {
            try {
                TUI.step(`Killing ${target.type} PID ${target.pid}`, 'DONE');
                process.kill(target.pid, 'SIGTERM');
            } catch {
                // If SIGTERM fails, try SIGKILL
                try {
                    process.kill(target.pid, 'SIGKILL');
                } catch (err2: any) {
                    TUI.step(`Failed to kill PID ${target.pid}: ${err2.message}`, 'FAIL', TUI.red);
                }
            }
        }

        TUI.footer();
        TUI.success('All docmd instances have been stopped.');

    } catch (error: any) {
        TUI.error('Error during stop', error.message);
    }
}