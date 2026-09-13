import { notFound, redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { AnswerRefresh } from "@/components/answer-refresh";
import Link from "next/link";
import { z } from "zod";
async function readSavedAnswer(id: string) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await serverSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await db
    .from("ai_generations")
    .select("answer,created_at,status,lease_expires_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("Saved answers are temporarily unavailable.");
  if (!data) notFound();
  const pending = data.status === "pending" && Date.parse(data.lease_expires_at || "") > Date.now();
  return { data, pending };
}

export default async function SavedAnswer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, pending } = await readSavedAnswer(id);
  return (
    <main className="standalone-page">
      <Brand />
      <article className="saved-answer">
        <span className="eyebrow">YOUR SAVED GEMINI ANSWER</span>
        <h1>{pending ? "Your answer is being prepared." : data.status === "complete" ? "A thought worth keeping." : "This answer did not finish."}</h1>
        <p>{data.answer?.answer || (pending ? "This question already has a reserved generation. Checking this page only reads its saved status and does not start another Gemini request." : "No successful answer was saved. You can return to the studio, use a guided hint, or explicitly try again.")}</p>
        {data.answer?.hint && <blockquote>{data.answer.hint}</blockquote>}
        <small>
          {new Date(data.created_at).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC · Private to your account
        </small>
        {pending && <AnswerRefresh />}
        <Link href="/studio" className="button primary">
          Return to the studio
        </Link>
      </article>
    </main>
  );
}
