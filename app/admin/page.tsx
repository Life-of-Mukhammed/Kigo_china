import AdminPanel from "@/components/admin-panel";
import Link from "next/link";

import { identity } from "@/lib/kigo-store";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const user = await identity();
  if (!user) redirect("/login?next=%2Fadmin");
  if (user?.role !== "admin")
    return (
      <main style={{ maxWidth: 600, margin: "100px auto", padding: 24 }}>
        <h1>Admin huquqi kerak</h1>
        <p>Bu sahifa faqat administratorlar uchun.</p>
        <Link href="/profil">Shaxsiy kabinetga qaytish</Link>
      </main>
    );
  return <AdminPanel />;
}
