"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { uk } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn, formatDate } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type TripDateFieldProps = {
  id: string;
  label: string;
  date: Date;
  onSelect: (date: Date) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: (date: Date) => boolean;
};

export function TripDateField({
  id,
  label,
  date,
  onSelect,
  open,
  onOpenChange,
  disabled,
}: TripDateFieldProps) {
  const isMobile = useIsMobile();
  const title = label.replace(" *", "");

  const handleSelect = (nextDate: Date | undefined) => {
    if (!nextDate) return;
    onSelect(nextDate);
    onOpenChange(false);
  };

  const triggerClassName = cn(
    "h-11 w-full min-w-0 justify-start text-left font-normal text-base touch-manipulation sm:h-10 sm:text-sm",
    !date && "text-muted-foreground",
  );

  const calendar = (
    <Calendar
      mode="single"
      selected={date}
      onSelect={handleSelect}
      disabled={disabled}
      locale={uk}
      classNames={
        isMobile
          ? {
              head_cell:
                "text-muted-foreground rounded-md w-10 font-normal text-[0.8rem]",
              cell: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
              day: cn(
                buttonVariants({ variant: "ghost" }),
                "h-10 w-10 p-0 font-normal aria-selected:opacity-100 touch-manipulation",
              ),
            }
          : undefined
      }
    />
  );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      {isMobile ? (
        <>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={triggerClassName}
            onClick={() => onOpenChange(true)}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {formatDate(date.toISOString())}
          </Button>
          <Drawer
            open={open}
            onOpenChange={onOpenChange}
            shouldScaleBackground={false}
          >
            <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DrawerHeader className="pb-0">
                <DrawerTitle>{title}</DrawerTitle>
              </DrawerHeader>
              <div className="flex justify-center px-2 pb-4">{calendar}</div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover modal open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              className={triggerClassName}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {formatDate(date.toISOString())}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto max-w-[calc(100vw-2rem)] p-0"
            align="start"
            sideOffset={4}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            {calendar}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
