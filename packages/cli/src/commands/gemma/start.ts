/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import { debugLogger } from '@google/gemini-cli-core';
import { exitCli } from '../utils.js';
import {
  DEFAULT_PORT,
  getPidFilePath,
  getLogFilePath,
  getMlxVenvDir,
  SERVER_START_WAIT_MS,
  GEMMA_MODEL_NAME,
} from './constants.js';
import {
  getBinaryPath,
  isBinaryInstalled,
  isServerRunning,
  resolveGemmaConfig,
  writeServerProcessInfo,
} from './platform.js';

export async function startServer(
  binaryPath: string,
  port: number,
): Promise<boolean> {
  const alreadyRunning = await isServerRunning(port);
  if (alreadyRunning) {
    debugLogger.log(`MLX server already running on port ${port}`);
    return true;
  }

  const logPath = getLogFilePath();
  fs.mkdirSync(getMlxVenvDir(), { recursive: true });
  const tmpDir = path.dirname(getPidFilePath());
  fs.mkdirSync(tmpDir, { recursive: true });

  const logFd = fs.openSync(logPath, 'a');

  try {

    const child = spawn(binaryPath, ['-m', 'mlx_lm.server', '--model', GEMMA_MODEL_NAME, '--port', `${port}`], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });


    if (child.pid) {
      writeServerProcessInfo({
        pid: child.pid,
        binaryPath,
        port,
      });
    }

    child.unref();
  } finally {
    fs.closeSync(logFd);
  }

  await new Promise((resolve) => setTimeout(resolve, SERVER_START_WAIT_MS));
  return isServerRunning(port);
}

export const startCommand: CommandModule = {
  command: 'start',
  describe: 'Start the MLX server',
  builder: (yargs) =>
    yargs.option('port', {
      type: 'number',
      description: 'Port for the MLX server',
    }),
  handler: async (argv) => {
    let port: number | undefined;
    if (argv['port'] !== undefined) {
      port = Number(argv['port']);
    }

    if (!port) {
      const { configuredPort } = resolveGemmaConfig(DEFAULT_PORT);
      port = configuredPort;
    }

    const binaryPath = getBinaryPath();
    if (!binaryPath || !isBinaryInstalled(binaryPath)) {
      debugLogger.error(
        chalk.red(
          'MLX binary not found. Run "gemma setup" first.',
        ),
      );
      await exitCli(1);
      return;
    }

    const alreadyRunning = await isServerRunning(port);
    if (alreadyRunning) {
      debugLogger.log(
        chalk.green(`MLX server is already running on port ${port}.`),
      );
      await exitCli(0);
      return;
    }

    debugLogger.log(`Starting MLX server on port ${port}...`);

    const started = await startServer(binaryPath, port);
    if (started) {
      debugLogger.log(chalk.green(`MLX server started on port ${port}.`));
      debugLogger.log(chalk.dim(`Logs: ${getLogFilePath()}`));
      await exitCli(0);
    } else {
      debugLogger.error(
        chalk.red('Server may not have started correctly. Check logs:'),
      );
      debugLogger.error(chalk.dim(`  ${getLogFilePath()}`));
      await exitCli(1);
    }
  },
};
