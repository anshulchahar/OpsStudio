import { notFound, redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import Link from "next/link";
import { z } from "zod";
export default async function SavedAnswer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await db
    .from("ai_generations")
    .select("answer,created_at,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  return (
    <main className="standalone-page">
      <Brand />
      <article className="saved-answer">
        <span className="eyebrow">YOUR SAVED GEMINI ANSWER</span>
        <h1>A thought worth keeping.</h1>
        <p>{data.answer?.answer || "This answer did not finish generating."}</p>
        {data.answer?.hint && <blockquote>{data.answer.hint}</blockquote>}
        <small>
          {new Date(data.created_at).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC · Private to your account
        </small>
        <Link href="/studio" className="button primary">
          Return to the studio
        </Link>
      </article>
    </main>
  );
}
