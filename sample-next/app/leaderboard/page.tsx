"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LeaderboardPage() {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    const score: any = null;
    setLabel(score.toFixed(0));
  }, []);

  return <main className="wrap"><section className="hero"><span className="eyebrow">SEEDED ROUTE · /LEADERBOARD</span><h1>Leaderboard</h1><p>The score is intentionally null so number formatting throws in the client.</p><span className="seed-note">Seeded error 3 · score.toFixed</span><nav className="links"><Link href="/">Event preview · Error 2</Link><Link href="/events">Events list · Error 1</Link></nav></section><section className="route-card"><span className="eyebrow">YOUR SCORE</span><div className="score">{label}</div><p>When fixed, a missing score safely displays as 0.</p></section></main>;
}
