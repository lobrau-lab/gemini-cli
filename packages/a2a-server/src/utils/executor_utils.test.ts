/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { pushTaskStateFailed } from './executor_utils.js';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';

describe('executor_utils', () => {
  describe('pushTaskStateFailed', () => {
    it('publishes state change event for Error objects', async () => {
      const publishMock = vi.fn();
      const eventBus = { publish: publishMock } as unknown as ExecutionEventBus;

      const error = new Error('Test error message');
      await pushTaskStateFailed(error, eventBus, 'task-123', 'ctx-456');

      expect(publishMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'status-update',
          taskId: 'task-123',
          contextId: 'ctx-456',
          final: true,
          status: expect.objectContaining({
            state: 'failed',
            message: expect.objectContaining({
              kind: 'message',
              role: 'agent',
              parts: [{ kind: 'text', text: 'Test error message' }],
              taskId: 'task-123',
              contextId: 'ctx-456',
            }),
          }),
          metadata: expect.objectContaining({
            coderAgent: { kind: 'state-change' },
            error: 'Test error message',
            model: 'unknown',
          }),
        }),
      );
    });

    it('publishes state change event for unknown objects', async () => {
      const publishMock = vi.fn();
      const eventBus = { publish: publishMock } as unknown as ExecutionEventBus;

      const error = 'Not an Error object';
      await pushTaskStateFailed(error, eventBus, 'task-123', 'ctx-456');

      expect(publishMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'status-update',
          taskId: 'task-123',
          contextId: 'ctx-456',
          final: true,
          status: expect.objectContaining({
            state: 'failed',
            message: expect.objectContaining({
              kind: 'message',
              role: 'agent',
              parts: [{ kind: 'text', text: 'Agent execution error' }],
              taskId: 'task-123',
              contextId: 'ctx-456',
            }),
          }),
          metadata: expect.objectContaining({
            coderAgent: { kind: 'state-change' },
            error: 'Agent execution error',
            model: 'unknown',
          }),
        }),
      );
    });
  });
});
