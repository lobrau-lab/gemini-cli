/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import fs from 'node:fs';
import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import chalk from 'chalk';
import { debugLogger } from '@google/gemini-cli-core';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { exitCli } from '../utils.js';
import { getMlxVenvDir, GEMMA_MODEL_NAME, DEFAULT_PORT } from './constants.js';
import {
  detectPlatform,
  getBinaryPath,
  isBinaryInstalled,
} from './platform.js';
import { startServer } from './start.js';
import readline from 'node:readline';

const log = (msg: string) => debugLogger.log(msg);
const logError = (msg: string) => debugLogger.error(msg);

async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(
        answer.trim().toLowerCase() === 'y' ||
          answer.trim().toLowerCase() === 'yes',
      );
    });
  });
}


function spawnInherited(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn(command, args, {
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', reject);
  });
}

interface SetupArgs {
  port: number;
  skipModel: boolean;
  start: boolean;
  force: boolean;
  consent: boolean;
}

async function handleSetup(argv: SetupArgs): Promise<number> {
  const { port, force } = argv;
  let autoStartServer = true;
  let settingsUpdated = false;
  let serverStarted = false;

  const platform = detectPlatform();
  if (!platform) {
    logError(
      chalk.red(`Unsupported platform: ${process.platform}-${process.arch}`),
    );
    logError(
      'MLX server is only available for Apple Silicon: macOS (ARM64)',
    );
    return 1;
  }
  log(chalk.dim(`  Platform: ${platform.key}`));

  if (!argv.consent) {
    log('');
    log('This will create a Python virtual environment and install mlx-lm.');
    log(
      `Gemma model (${GEMMA_MODEL_NAME}) will be downloaded on first run. By proceeding, you agree to the`,
    );
    log('Gemma Terms of Use: https://ai.google.dev/gemma/terms');
    log('');

    const accepted = await promptYesNo('Do you want to continue?');
    if (!accepted) {
      log('Setup cancelled.');
      return 0;
    }
  }

  const binaryPath = getBinaryPath()!;
  const venvDir = getMlxVenvDir();
  const alreadyInstalled = isBinaryInstalled();

  if (alreadyInstalled && !force) {
    log('');
    log(chalk.green('  ✓ MLX python environment already setup at:'));
    log(chalk.dim(`    ${venvDir}`));
  } else {
    log('');
    log('  Setting up MLX Python environment...');

    try {
      fs.mkdirSync(path.dirname(venvDir), { recursive: true });
      if (fs.existsSync(venvDir)) {
          fs.rmSync(venvDir, { recursive: true, force: true });
      }

      const venvExitCode = await spawnInherited('python3', ['-m', 'venv', venvDir]);
      if (venvExitCode !== 0) {
        throw new Error(`Failed to create venv (exit code ${venvExitCode})`);
      }

      const pipPath = path.join(venvDir, 'bin', 'pip');
      const pipExitCode = await spawnInherited(pipPath, ['install', 'mlx-lm']);
      if (pipExitCode !== 0) {
         throw new Error(`Failed to install mlx-lm (exit code ${pipExitCode})`);
      }

      log(chalk.green('  ✓ MLX Python environment setup successfully'));
    } catch (error) {
      logError(
        chalk.red(
          `  ✗ Failed to setup MLX environment: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      return 1;
    }
  }

  log('');
  log('  Configuring settings...');
  try {
    const settings = loadSettings(process.cwd());

    const existingUserGemma =
      settings.forScope(SettingScope.User).settings.experimental
        ?.gemmaModelRouter ?? {};
    autoStartServer = existingUserGemma.autoStartServer ?? true;
    const existingUserExperimental =
      settings.forScope(SettingScope.User).settings.experimental ?? {};
    settings.setValue(SettingScope.User, 'experimental', {
      ...existingUserExperimental,
      gemmaModelRouter: {
        autoStartServer,
        ...(existingUserGemma.binaryPath !== undefined
          ? { binaryPath: existingUserGemma.binaryPath }
          : {}),
      },
    });

    const existingWorkspaceGemma =
      settings.forScope(SettingScope.Workspace).settings.experimental
        ?.gemmaModelRouter ?? {};
    const existingWorkspaceExperimental =
      settings.forScope(SettingScope.Workspace).settings.experimental ?? {};
    settings.setValue(SettingScope.Workspace, 'experimental', {
      ...existingWorkspaceExperimental,
      gemmaModelRouter: {
        ...existingWorkspaceGemma,
        enabled: true,
        classifier: {
          ...existingWorkspaceGemma.classifier,
          host: `http://localhost:${port}`,
          model: GEMMA_MODEL_NAME,
        },
      },
    });

    log(chalk.green('  ✓ Settings updated'));
    log(chalk.dim('    User (~/.gemini/settings.json): autoStartServer'));
    log(
      chalk.dim('    Workspace (.gemini/settings.json): enabled, classifier'),
    );
    settingsUpdated = true;
  } catch (error) {
    logError(
      chalk.red(
        `  ✗ Failed to update settings: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    logError(
      '  You can manually add the configuration to ~/.gemini/settings.json',
    );
  }

  if (argv.start) {
    log('');
    log('  Starting MLX server...');
    serverStarted = await startServer(binaryPath, port);
    if (serverStarted) {
      log(chalk.green(`  ✓ Server started on port ${port}`));
    } else {
      log(
        chalk.yellow(
          `  ! Server may not have started correctly. Check: gemma status`,
        ),
      );
    }
  }

  const routingActive = settingsUpdated && serverStarted;
  const setupSucceeded = settingsUpdated && (!argv.start || serverStarted);
  log('');
  log(chalk.dim('─'.repeat(40)));
  if (routingActive) {
    log(chalk.bold.green('  Setup complete! Local model routing is active.'));
  } else if (settingsUpdated) {
    log(
      chalk.bold.green('  Setup complete! Local model routing is configured.'),
    );
  } else {
    log(
      chalk.bold.yellow(
        '  Setup incomplete. Manual settings changes are still required.',
      ),
    );
  }
  log('');
  log('  How it works: Every request is classified by the local Gemma model.');
  log(
    '  Simple tasks (file reads, quick edits) route to ' +
      chalk.cyan('Flash') +
      ' for speed.',
  );
  log(
    '  Complex tasks (debugging, architecture) route to ' +
      chalk.cyan('Pro') +
      ' for quality.',
  );
  log('  This happens automatically — just use the CLI as usual.');
  log('');
  if (!settingsUpdated) {
    log(
      chalk.yellow(
        '  Fix the settings update above, then rerun "gemma status".',
      ),
    );
    log('');
  } else if (!argv.start) {
    log(chalk.yellow('  Note: Run "gemma start" to start the server.'));
    if (autoStartServer) {
      log(
        chalk.yellow(
          '  Or restart the CLI to auto-start it on the next launch.',
        ),
      );
    }
    log('');
  } else if (!serverStarted) {
    log(
      chalk.yellow(
        '  Review the server logs and rerun "gemma start" after fixing the issue.',
      ),
    );
    log('');
  }
  log('  Useful commands:');
  log(chalk.dim('    gemma status   Check routing status'));
  log(chalk.dim('    gemma start    Start the MLX server'));
  log(chalk.dim('    gemma stop     Stop the MLX server'));
  log(chalk.dim('    /gemma         Check status inside a session'));
  log('');

  return setupSucceeded ? 0 : 1;
}

export const setupCommand: CommandModule = {
  command: 'setup',
  describe: 'Download and configure Gemma local model routing',
  builder: (yargs) =>
    yargs
      .option('port', {
        type: 'number',
        default: DEFAULT_PORT,
        description: 'Port for the MLX server',
      })
      .option('skip-model', {
        type: 'boolean',
        default: false,
        description: 'Skip model download (binary only)',
      })
      .option('start', {
        type: 'boolean',
        default: true,
        description: 'Start the server after setup',
      })
      .option('force', {
        type: 'boolean',
        default: false,
        description: 'Re-download binary and model even if already present',
      })
      .option('consent', {
        type: 'boolean',
        default: false,
        description: 'Skip interactive consent prompt (implies acceptance)',
      }),
  handler: async (argv) => {
    const exitCode = await handleSetup({
      port: Number(argv['port']),
      skipModel: Boolean(argv['skipModel']),
      start: Boolean(argv['start']),
      force: Boolean(argv['force']),
      consent: Boolean(argv['consent']),
    });
    await exitCli(exitCode);
  },
};
