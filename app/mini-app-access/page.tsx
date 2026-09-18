import { redirect } from "next/navigation";

/** Залишено для старих посилань — керування тепер у профілі. */
export default function MiniAppAccessPage() {
  redirect("/user?tab=mini-app");
}
