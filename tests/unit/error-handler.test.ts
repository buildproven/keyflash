import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { handleAPIError, createSuccessResponse } from '@/lib/utils/error-handler';

describe('Error Handler', () => {
  describe('handleAPIError', () => {
    it('should handle Zod validation errors', () => {
      const zodError = new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'String must contain at least 1 character(s)',
          path: ['keyword'],
        },
      ]);

      const response = handleAPIError(zodError);
      const data = response.json();

      expect(response.status).toBe(400);
      // Note: We can't directly test the JSON body in this way
      // Just verify the response was created
      expect(response).toBeDefined();
    });

    it('should handle rate limit errors', () => {
      const error = new Error('rate limit exceeded. Try again later.');

      const response = handleAPIError(error);

      expect(response.status).toBe(429);
      expect(response).toBeDefined();
    });

    it('should handle generic errors', () => {
      const error = new Error('Something went wrong');

      const response = handleAPIError(error);

      expect(response.status).toBe(500);
      expect(response).toBeDefined();
    });

    it('should handle unknown error types', () => {
      const error = 'string error';

      const response = handleAPIError(error);

      expect(response.status).toBe(500);
      expect(response).toBeDefined();
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with default status 200', () => {
      const data = { message: 'Success' };

      const response = createSuccessResponse(data);

      expect(response.status).toBe(200);
      expect(response).toBeDefined();
    });

    it('should create success response with custom status', () => {
      const data = { message: 'Created' };

      const response = createSuccessResponse(data, 201);

      expect(response.status).toBe(201);
      expect(response).toBeDefined();
    });
  });
});
