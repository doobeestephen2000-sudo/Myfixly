import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — MyFixly" }, { name: "description", content: "How MyFixly handles your data." }] }),
  component: () => (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
        <div className="prose prose-neutral mt-6 max-w-none text-muted-foreground">
          <p>Your privacy matters. This policy explains what we collect and why.</p>
          <h3 className="mt-6 font-display text-xl font-bold text-foreground">Information we collect</h3>
          <p>For customers: search preferences and any reviews you leave. For mechanics: name, contact info, location, ID documents, and profile media.</p>
          <h3 className="mt-6 font-display text-xl font-bold text-foreground">How we use it</h3>
          <p>To operate the marketplace, verify mechanics, display listings, process payments, and improve the platform.</p>
          <h3 className="mt-6 font-display text-xl font-bold text-foreground">Sharing</h3>
          <p>Mechanic public profile fields (name, city, brands, services, reviews) are visible to all users. Contact numbers are used for WhatsApp/call deep links you choose to open. IDs remain private and are used only for verification.</p>
          <h3 className="mt-6 font-display text-xl font-bold text-foreground">Your rights</h3>
          <p>You can request access, correction, or deletion of your account data by contacting us.</p>
        </div>
      </main>
  ),
});
