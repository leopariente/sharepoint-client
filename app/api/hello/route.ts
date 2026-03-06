// Phase 2 concept: Route Handlers live in app/api/.../route.ts
// They are NOT pages — they return HTTP responses, not JSX.
// Named exports (GET, POST, PUT, DELETE) map directly to HTTP methods.
// Next.js uses the Web-standard Request/Response objects (not Express's req/res).

export async function GET() {
  return Response.json({ message: "Hello from the API!" });
}
