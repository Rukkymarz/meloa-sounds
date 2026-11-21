"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function CountryPicker({ countries, value }: { countries: { code: string; name: string }[]; value: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label style={{ display: "block", maxWidth: 360 }}>
      <span className="sr">Country</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => start(() => router.push(`/new?country=${e.target.value}`, { scroll: false }))}
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
