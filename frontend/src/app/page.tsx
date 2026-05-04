"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FullPageLoading } from "@/components/layout/full-page-loading";
import { getToken } from "@/lib/auth/token";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);

  return <FullPageLoading message="Redirecting…" />;
}
