/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GemmaModelRouterSettings } from '@google/gemini-cli-core';

const mockGetBinaryPath = vi.hoisted(() => vi.fn());
const mockIsServerRunning = vi.hoisted(() => vi.fn());
const mockStartServer = vi.hoisted(() => vi.fn());

vi.mock('../commands/gemma/platform.js', () => ({
  getBinaryPath: mockGetBinaryPath,
  isServerRunning: mockIsServerRunning,
}));

vi.mock('../commands/gemma/start.js', () => ({
  startServer: mockStartServer,
}));

import { MlxServerManager } from './mlxServerManager.js';

describe('MlxServerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    mockIsServerRunning.mockResolvedValue(false);
    mockStartServer.mockResolvedValue(true);
  });

  it('uses the configured custom binary path when auto-starting', async () => {
    mockGetBinaryPath.mockReturnValue('/user/mlx/bin/python3');

    const settings: GemmaModelRouterSettings = {
      enabled: true,
      binaryPath: '/workspace/mlx',
      classifier: {
        host: 'http://localhost:8123',
      },
    };

    await MlxServerManager.ensureRunning(settings);

    expect(mockGetBinaryPath).toHaveBeenCalledTimes(1);
    expect(fs.existsSync).toHaveBeenCalledWith('/user/mlx/bin/python3');
    expect(mockStartServer).toHaveBeenCalledWith('/user/mlx/bin/python3', 8123);
  });

  it('falls back to the default binary path when no custom path is configured', async () => {
    mockGetBinaryPath.mockReturnValue('/default/mlx/bin/python3');

    const settings: GemmaModelRouterSettings = {
      enabled: true,
      classifier: {
        host: 'http://localhost:9379',
      },
    };

    await MlxServerManager.ensureRunning(settings);

    expect(mockGetBinaryPath).toHaveBeenCalledTimes(1);
    expect(fs.existsSync).toHaveBeenCalledWith('/default/mlx/bin/python3');
    expect(mockStartServer).toHaveBeenCalledWith('/default/mlx/bin/python3', 9379);
  });
});
