import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionActor } from "@/lib/actor";
import { listTokens } from "@/lib/tokens";
import { TokenManager } from "@/components/token-manager";

export default async function SettingsPage() {
  const actor = await sessionActor();
  if (!actor) redirect("/");
  const tokens = await listTokens(actor.login);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          API tokens let the <code>labnotes</code> CLI and your agents log findings
          on your behalf.
        </p>
      </div>
      <TokenManager initialTokens={tokens} origin={origin} />
    </div>
  );
}
