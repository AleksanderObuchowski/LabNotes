"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGitHub() {
  await signIn("github", { redirectTo: "/projects" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
