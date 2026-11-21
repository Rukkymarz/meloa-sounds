import { redirect } from "next/navigation";

// Charts now live inside the New tab.
export default async function Charts({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const sp = await searchParams;
  redirect(sp.country ? `/new?country=${encodeURIComponent(sp.country)}` : "/new");
}
