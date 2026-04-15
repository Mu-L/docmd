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
import chalk from 'chalk';

/**
 * find and kill running docmd processes
 * If port is provided, only kill the process listening on that port.
 */
export async function stopServer(port: any) {
    if (port) {
        console.log(chalk.blue(`\n🔍 Searching for docmd server on port ${chalk.bold(port)}...`));
        try {
            const pid = execSync(`lsof -t -i:${port}`).toString().trim();
            if (pid) {
                console.log(chalk.yellow(`   Found process ${pid} on port ${port}. Stopping...`));
                process.kill(Number(pid), 'SIGTERM');
                console.log(chalk.bold.green(`\n✅ docmd server on port ${port} has been stopped.\n`));
                return;
            }
        } catch (e) {
            console.log(chalk.green(`✅ No docmd server found on port ${port}.\n`));
            return;
        }
    }

    console.log(chalk.blue('\n🔍 Searching for all running docmd servers...'));

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

            const isNotCurrent = pid !== currentPid && command.indexOf('stop') === -1;

            if (isDocmd && isNotCurrent) {
                targets.push({ pid, command });
            }
        }

        if (targets.length === 0) {
            console.log(chalk.green('✅ No running docmd servers found.\n'));
            return;
        }

        console.log(chalk.yellow(`   Found ${targets.length} process(es). Stopping...`));

        for (const target of targets) {
            try {
                process.stdout.write(chalk.dim(`     - Killing PID ${target.pid}... `));
                process.kill(target.pid, 'SIGTERM');
                process.stdout.write(chalk.green('Done.\n'));
            } catch (err) {
                // If SIGTERM fails, try SIGKILL
                try {
                    process.kill(target.pid, 'SIGKILL');
                    process.stdout.write(chalk.yellow('Forced.\n'));
                } catch (err2) {
                    process.stdout.write(chalk.red(`Failed: ${err2.message}\n`));
                }
            }
        }

        console.log(chalk.bold.green('\n✅ All docmd servers have been stopped.\n'));

    } catch (error) {
        console.error(chalk.red('❌ Error during stop:'), error.message);
    }
}