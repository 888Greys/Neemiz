"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Design-system kitchen sink. A living reference for every primitive and its
// states — the single place to eyeball the system and catch drift. Not linked
// in nav; visit /design.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-black uppercase tracking-widest text-on-surface-variant">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [loading, setLoading] = useState(false);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="font-brand text-3xl text-primary-fixed">Nezeem</span>
        <h1 className="text-2xl font-black tracking-tight text-on-surface">Design System</h1>
        <p className="text-sm text-on-surface-variant">
          Token-driven primitives. One source of truth for surface, color, focus, and motion.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Place Bet</Button>
          <Button variant="secondary">Cash Out</Button>
          <Button variant="outline">Details</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Withdraw</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1600); }}>
            Deposit
          </Button>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card interactive>
            <CardHeader>
              <CardTitle>Aviator</CardTitle>
              <CardDescription>Live crash game · 1.24x</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-on-surface-variant">Interactive surface with hover affordance.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Play</Button>
              <Button size="sm" variant="ghost">Rules</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Wallet</CardTitle>
              <CardDescription>KSh 12,450.00</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Badge tone="success">Deposit ✓</Badge>
              <Badge tone="warning">Pending</Badge>
              <Badge tone="danger">Failed</Badge>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone number" placeholder="07XX XXX XXX" hint="M-Pesa registered number" />
          <Input label="Amount (KSh)" placeholder="100" defaultValue="49" error="Max transfer is KSh 50" />
        </div>
      </Section>

      <Section title="Badges / status">
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="success">Won</Badge>
          <Badge tone="danger">Lost</Badge>
          <Badge tone="warning">Void</Badge>
          <Badge tone="info">Live</Badge>
        </div>
      </Section>
    </main>
  );
}
