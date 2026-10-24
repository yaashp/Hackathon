"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function EventPreview() {
  const [title, setTitle] = useState("Loading event…");

  useEffect(() => {
    const event: any = undefined;
    setTitle(event.title.toUpperCase());
  }, []);

  return <main className="wrap"><section className="hero"><span className="eyebrow">FAIR-DROP · SEEDED NEXT.JS APP</span><h1>{title}</h1><p>This sample has three intentional runtime errors for trying the debugger. Open a route, then use Fair-Drop to inspect and fix its seeded source line.</p><span className="seed-note">Seeded error 2 · event.title</span><nav className="links"><Link href="/events">Events list · Error 1</Link><Link href="/leaderboard">Leaderboard · Error 3</Link><Link href="http://127.0.0.1:8000">Open Fair-Drop</Link></nav></section><section className="route-card"><span className="eyebrow">CURRENT ROUTE</span><h2>Event Preview</h2><p>The event API response is intentionally missing so the title read fails when the client effect runs.</p></section></main>;
}
