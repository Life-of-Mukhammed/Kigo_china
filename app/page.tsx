import Portal from "@/components/portal";
import { serverBootstrap } from "@/lib/server-bootstrap";
export const dynamic = "force-dynamic";
export default async function Home() {
  return <Portal path="/" initialData={await serverBootstrap()} />;
}
