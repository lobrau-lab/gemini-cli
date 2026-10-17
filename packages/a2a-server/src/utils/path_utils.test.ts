/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { validateWorkspacePath } from './path_utils.js';
import fs from 'node:fs';

// Mock resolveToRealPath and isSubpath
vi.mock('@google/gemini-cli-core', () => ({
  resolveToRealPath: (p: string) => p,
  isSubpath: (parent: string, child: string) => child.startsWith(parent),
}));

describe('path_utils', () => {
  describe('validateWorkspacePath', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('throws custom ENOENT error when path does not exist', async () => {
      vi.spyOn(fs.promises, 'stat').mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), {
          code: 'ENOENT',
        }),
      );

      await expect(
        validateWorkspacePath('/allowed/path/missing_dir', '/allowed/path'),
      ).rejects.toThrow('The path "/allowed/path/missing_dir" does not exist.');
    });

    it('throws custom error when path is not a directory', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        isDirectory: () => false,
      } as unknown as import('node:fs').Stats);

      await expect(
        validateWorkspacePath('/allowed/path/file.txt', '/allowed/path'),
      ).rejects.toThrow(
        'The path "/allowed/path/file.txt" is not a directory.',
      );
    });

    it('throws security violation error when path is outside allowed root', async () => {
      await expect(
        validateWorkspacePath('../other/path', '/allowed/path'),
      ).rejects.toThrow(
        'Security violation: The path "../other/path" is outside the allowed root directory.',
      );
    });

    it('returns canonical path when valid', async () => {
      vi.spyOn(fs.promises, 'stat').mockResolvedValue({
        isDirectory: () => true,
      } as unknown as import('node:fs').Stats);

      const result = await validateWorkspacePath(
        '/allowed/path/valid_dir',
        '/allowed/path',
      );
      expect(result).toBe('/allowed/path/valid_dir');
    });
  });
});
