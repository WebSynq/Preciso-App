// Augment the Express Request type to include authenticated user fields
// set by the requireAuth middleware.
declare namespace Express {
  interface Request {
    /** Authenticated user, set by requireAuth middleware. */
    user?: { id: string; email: string };
    /** Raw JWT access token, set by requireAuth middleware. */
    accessToken?: string;
  }
}
