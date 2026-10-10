/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { Storage } from '@google/gemini-cli-core';

export const MLX_LM_VERSION = '0.21.0';
export const GEMMA_MODEL_NAME = 'mlx-community/quantized-gemma-2b';
export const DEFAULT_PORT = 9379;
export const HEALTH_CHECK_TIMEOUT_MS = 5000;
export const SERVER_START_WAIT_MS = 3000;

export function getMlxVenvDir(): string {
  return path.join(Storage.getGlobalGeminiDir(), 'mlx-venv');
}

export function getPidFilePath(): string {
  return path.join(Storage.getGlobalTempDir(), 'mlx-server.pid');
}

export function getLogFilePath(): string {
  return path.join(Storage.getGlobalTempDir(), 'mlx-server.log');
}
