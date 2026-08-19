"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type PendingNavigation = { type: "href"; href: string } | { type: "back" };

type LeaveActiveShiftContextValue = {
  requestLeave: (navigation: PendingNavigation) => void;
};

const LeaveActiveShiftContext =
  createContext<LeaveActiveShiftContextValue | null>(null);

export const useLeaveActiveShiftGuard = () =>
  useContext(LeaveActiveShiftContext);

const isSamePageHref = (href: string) => {
  const next = new URL(href, window.location.href);
  return (
    next.origin === window.location.origin &&
    next.pathname === window.location.pathname &&
    next.search === window.location.search
  );
};

interface LeaveActiveShiftGuardProps {
  enabled: boolean;
  children: ReactNode;
}

export function LeaveActiveShiftGuard({
  enabled,
  children,
}: LeaveActiveShiftGuardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<PendingNavigation | null>(null);
  const bypassRef = useRef(false);

  const requestLeave = useCallback((navigation: PendingNavigation) => {
    pendingRef.current = navigation;
    setOpen(true);
  }, []);

  const stayOnPage = () => {
    pendingRef.current = null;
    setOpen(false);
  };

  const confirmLeave = () => {
    const navigation = pendingRef.current;
    bypassRef.current = true;
    pendingRef.current = null;
    setOpen(false);

    if (!navigation) {
      return;
    }

    if (navigation.type === "href") {
      router.push(navigation.href);
      return;
    }

    if (window.history.length > 2) {
      window.history.go(-2);
      return;
    }

    router.push("/");
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    bypassRef.current = false;
    if (window.history.state?.leaveActiveShiftGuard !== true) {
      window.history.pushState(
        { leaveActiveShiftGuard: true },
        "",
        window.location.href
      );
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    const onPopState = () => {
      if (bypassRef.current) {
        return;
      }
      window.history.pushState(
        { leaveActiveShiftGuard: true },
        "",
        window.location.href
      );
      requestLeave({ type: "back" });
    };

    const onClick = (event: MouseEvent) => {
      if (bypassRef.current || event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a");
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      ) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || isSamePageHref(href)) {
        return;
      }

      const next = new URL(href, window.location.href);
      if (next.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      requestLeave({
        type: "href",
        href: `${next.pathname}${next.search}${next.hash}`,
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled, requestLeave]);

  if (!enabled) {
    return children;
  }

  return (
    <LeaveActiveShiftContext.Provider value={{ requestLeave }}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            stayOnPage();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Зміна ще не закрита</AlertDialogTitle>
            <AlertDialogDescription>
              Ви намагаєтесь залишити сторінку заповнення зміни, не завершивши
              її. Збережені дані не пропадуть, але зміна залишиться активною,
              доки ви її не закриєте.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={confirmLeave}>
              Вийти без закриття
            </Button>
            <Button type="button" onClick={stayOnPage}>
              Залишитись на сторінці
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LeaveActiveShiftContext.Provider>
  );
}
