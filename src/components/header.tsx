import { FlaskConical } from "lucide-react";
import { auth } from "@/auth";
import { DEV_LOGIN, devMode } from "@/lib/dev";
import { signOutAction } from "@/lib/auth-actions";
import { NavTabs } from "@/components/nav-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();
  const user =
    session?.user ?? (devMode ? { name: DEV_LOGIN, image: null } : null);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <FlaskConical className="size-5" />
          <span>
            Lab<span className="text-muted-foreground">Notes</span>
          </span>
        </div>
        {user ? <NavTabs /> : null}
        <div className="flex-1" />
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-7">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback className="text-xs">
                {(user.name ?? "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
