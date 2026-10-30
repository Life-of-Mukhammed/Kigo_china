import Portal from "@/components/portal";
import { notFound } from "next/navigation";
import { serverBootstrap } from "@/lib/server-bootstrap";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const allowed = [
    "turnirlar",
    "boshqaruv",
    "tashkilotchilar",
    "sportchilar",
    "jamoalar",
    "biz-haqimizda",
    "turnir-yaratish",
    "tashkilotchi-yaratish",
    "jamoa-yaratish",
    "profil",
    "natijalar",
    "hamkorlik",
    "shartlar",
    "landing",
    "login",
    "register",
  ];
  if (!allowed.includes(path[0]) || path.length > 2) notFound();
  return (
    <Portal path={"/" + path.join("/")} initialData={await serverBootstrap()} />
  );
}
