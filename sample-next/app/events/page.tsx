"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EventRow = { id: string; name: string };

export default function EventsPage() {
  const [cards, setCards] = useState<EventRow[]>([]);
  useEffect(() => {
    const events: any = undefined;
    setCards(events.map((event: EventRow) => event));
  }, []);

  return <main className="wrap"><section className="hero"><span className="eyebrow">SEEDED ROUTE · /EVENTS</span><h1>Available events</h1><p>The list is intentionally undefined to seed a runtime error at the render mapping call.</p><span className="seed-note">Seeded error 1 · events.map</span><nav className="links"><Link href="/">Event preview · Error 2</Link><Link href="/leaderboard">Leaderboard · Error 3</Link></nav></section><section className="route-card"><h2>{cards.length} event cards</h2><p>When fixed, this page safely treats a missing response as an empty list.</p></section></main>;
}
