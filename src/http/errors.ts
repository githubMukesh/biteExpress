import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { MongoServerError } from 'mongodb';

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
  ) {
    super(detail ?? title);
  }
  static badRequest = (detail: string) => new ApiError(400, 'Bad Request', detail);
  static notFound = (detail: string) => new ApiError(404, 'Not Found', detail);
  static conflict = (detail: string) => new ApiError(409, 'Conflict', detail);
  static unprocessable = (detail: string) => new ApiError(422, 'Unprocessable Entity', detail);
}

// RFC 9457 problem+json. ZodError -> 422 with field issues; duplicate key -> 409.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const instance = (req.id as string | undefined) ?? undefined;

  if (err instanceof ZodError) {
    res
      .status(422)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Request validation failed',
        instance,
        errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    return;
  }

  if (err instanceof ApiError) {
    res
      .status(err.status)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: err.title, status: err.status, detail: err.detail, instance });
    return;
  }

  if (err instanceof MongoServerError && err.code === 11000) {
    res
      .status(409)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: 'Conflict', status: 409, detail: 'Duplicate restaurant', instance });
    return;
  }

  req.log?.error(err);
  res
    .status(500)
    .type('application/problem+json')
    .json({ type: 'about:blank', title: 'Internal Server Error', status: 500, instance });
};
