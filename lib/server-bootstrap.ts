import { GET } from "@/app/api/kigo/route";
// Share the request identity and D1 data with the first server render.
export async function serverBootstrap() {
  const response = await GET(
    new Request("https://kigo.internal/api/kigo?action=bootstrap"),
  );
  return response.ok ? ((await response.json()) as Record<string, any>) : null;
}
