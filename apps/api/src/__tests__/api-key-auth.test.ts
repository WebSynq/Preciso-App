/**
 * Tests for API key authentication middleware.
 * Verifies timing-safe comparison and correct HTTP responses.
 */
import type { NextFunction, Request, Response } from 'express';

import { requireApiKey } from '../middleware/api-key-auth';

function mockReq(authHeader?: string): Partial<Request> {
  return {
    headers: { authorization: authHeader },
    ip: '127.0.0.1',
  };
}

function mockRes(): { status: jest.Mock; json: jest.Mock; statusCode: number } {
  const res = {
    statusCode: 200,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  return res;
}

describe('requireApiKey middleware', () => {
  const VALID_KEY = 'super-secret-system-key-min32chars!!';

  beforeEach(() => {
    process.env['SYSTEM_API_KEY'] = VALID_KEY;
  });

  afterEach(() => {
    delete process.env['SYSTEM_API_KEY'];
  });

  it('calls next() when the correct API key is provided', () => {
    const req = mockReq(`ApiKey ${VALID_KEY}`);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireApiKey(req as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireApiKey(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key required.' });
  });

  it('returns 401 when the API key is wrong', () => {
    const req = mockReq('ApiKey wrong-key');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireApiKey(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key.' });
  });

  it('returns 401 when Authorization header uses the wrong scheme', () => {
    const req = mockReq(`Bearer ${VALID_KEY}`);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireApiKey(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 500 when SYSTEM_API_KEY is not configured', () => {
    delete process.env['SYSTEM_API_KEY'];
    const req = mockReq(`ApiKey ${VALID_KEY}`);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireApiKey(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server configuration error.' });
  });

  it('does not call next when an empty key is provided', () => {
    const req = mockReq('ApiKey ');
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireApiKey(req as Request, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
  });
});
