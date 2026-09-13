"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function AnswerRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button className="button secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Checking saved answer…" : "Check saved answer"}
    </button>
  );
}
