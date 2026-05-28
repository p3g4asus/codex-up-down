"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { withBasePath } from "@/lib/base-path";

export function BrandLogo() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [logoError, setLogoError] = useState(false);

  return (
    <Link
      href="/"
      aria-label="Vai alla home"
      aria-current={isHome ? "page" : undefined}
      className={`relative mb-5 inline-flex items-center gap-2 rounded-full border bg-white/90 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 sm:gap-3 sm:px-4 ${
        isHome
          ? "border-emerald-500 ring-2 ring-emerald-200"
          : "border-emerald-200 hover:border-emerald-300"
      }`}
    >
      {logoError ? (
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tracking-tight text-emerald-50 sm:h-10 sm:w-10 ${
            isHome
              ? "bg-gradient-to-br from-emerald-600 to-emerald-800"
              : "bg-gradient-to-br from-emerald-700 to-emerald-900"
          }`}
        >
          MS
        </span>
      ) : (
        <Image
          src={withBasePath("/branding/cosi-logo.jpg")}
          alt="Logo supermercato COSI"
          width={40}
          height={40}
          unoptimized
          className="h-9 w-9 rounded-full border border-emerald-200 object-cover sm:h-10 sm:w-10"
          onError={() => setLogoError(true)}
          priority
        />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 sm:text-[11px] sm:tracking-[0.2em]">
          Supermercato
        </p>
        <p className="truncate text-xs font-semibold text-slate-900 sm:text-sm">
          Mercato dei Sapori
        </p>
      </div>
    </Link>
  );
}
