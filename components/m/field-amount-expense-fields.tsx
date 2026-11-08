"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  title: string;
  amountId: string;
  commentId: string;
  amount: string;
  comment: string;
  onAmountChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  showOptionalHint?: boolean;
};

export function FieldAmountExpenseFields({
  title,
  amountId,
  commentId,
  amount,
  comment,
  onAmountChange,
  onCommentChange,
  showOptionalHint = true,
}: Props) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {showOptionalHint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Необовʼязково</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={amountId}>Сума, ₴</Label>
        <Input
          id={amountId}
          inputMode="decimal"
          className="h-11 text-base"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={commentId}>Коментар</Label>
        <Textarea
          id={commentId}
          className="min-h-[72px] text-base"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
        />
      </div>
    </div>
  );
}
