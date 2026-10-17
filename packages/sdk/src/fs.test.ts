/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SdkAgentFilesystem } from './fs.js';
import type { Config as CoreConfig } from '@google/gemini-cli-core';
import fs from 'node:fs/promises';

describe('SdkAgentFilesystem', () => {
  let mockConfig: CoreConfig;
  let agentFs: SdkAgentFilesystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockConfig = {
      validatePathAccess: vi.fn().mockReturnValue(null), // no error by default
    } as unknown as CoreConfig;
    agentFs = new SdkAgentFilesystem(mockConfig);
  });

  describe('readFile', () => {
    it('returns null if validatePathAccess returns an error', async () => {
      vi.mocked(mockConfig.validatePathAccess).mockReturnValue('Access Denied');

      const result = await agentFs.readFile('/denied/path.txt');
      expect(result).toBeNull();
      expect(mockConfig.validatePathAccess).toHaveBeenCalledWith(
        '/denied/path.txt',
        'read',
      );
    });

    it('returns null if fs.readFile throws an error', async () => {
      vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'));

      const result = await agentFs.readFile('/missing/path.txt');
      expect(result).toBeNull();
      expect(fs.readFile).toHaveBeenCalledWith('/missing/path.txt', 'utf-8');
    });

    it('returns file content on successful read', async () => {
      vi.spyOn(fs, 'readFile').mockResolvedValue('file content');

      const result = await agentFs.readFile('/valid/path.txt');
      expect(result).toBe('file content');
    });
  });
});
