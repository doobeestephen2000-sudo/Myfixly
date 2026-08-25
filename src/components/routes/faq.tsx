import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "Is Myfixly free for customers?", a: "Yes — searching, viewing artisan profiles, and contacting service professionals is completely free for customers." },
  { q: "How are artisans verified?", a: "Every artisan uploads a valid ID and completes admin review. Verified badges are only given after this check." },
  { q: "How do I contact an artisan?", a: "Open a professional's profile and tap WhatsApp, Call, or send an inquiry through the form." },
  { q: "How much does it cost to register as a skilled artisan?", a: "There's a one-time registration fee set by the platform — you'll see the amount before payment." },
  { q: "Which payment methods are accepted?", a: "We use Paystack, which supports cards, bank transfer, USSD, and mobile money." },
  { q: "Can I list a business (not just an individual)?", a: "Yes — add your business name during registration. Both individuals and companies are welcome." },
  { q: "What if an artisan doesn't deliver as promised?", a: "Leave a review to help other customers, and contact us through the Contact page for support." },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Myfixly" },
      { name: "description", content: "Frequently asked questions about using Myfixly as a customer or mechanic." },
    ],
  }),
  component: FAQ,
});

function FAQ() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold">Frequently asked questions</h1>
        <p className="mt-3 text-muted-foreground">Everything you need to know about Myfixly.</p>
        <Accordion type="single" collapsible className="mt-8">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left font-display text-lg">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </main>
      <SiteFooter />
    </div>
  );
}
