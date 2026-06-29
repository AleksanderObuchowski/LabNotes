export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function apiError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
