import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — MyFixly" },
      { name: "description", content: "Read the MyFixly terms and conditions for customers and mechanics." },
    ],
  }),
  component: () => (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold">Terms & Conditions</h1>
      <div className="prose prose-neutral mt-6 max-w-none text-muted-foreground">
        <p>Welcome to MyFixly. By using our platform, you agree to these terms.</p>
        <h3 className="mt-6 font-display text-xl font-bold text-foreground">Platform use</h3>
        <p>MyFixly provides a marketplace to connect customers with verified artisans and professionals. You are responsible for the accuracy of the information you provide.</p>
        <h3 className="mt-6 font-display text-xl font-bold text-foreground">Payments and listings</h3>
        <p>Payments may be processed through supported gateways. Registration fees, service listings, and profile information are subject to platform rules and verification.</p>
        <h3 className="mt-6 font-display text-xl font-bold text-foreground">Liability</h3>
        <p>MyFixly does not directly provide the services offered by artisans. We act as a discovery and contact platform and are not responsible for the outcome of any third-party job.</p>
        <h3 className="mt-6 font-display text-xl font-bold text-foreground">Changes</h3>
        <p>We may update these terms over time. Continued use of the platform means you accept the latest version.</p>
      </div>
    </main>
  ),
});
