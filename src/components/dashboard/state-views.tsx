import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <AlertCircle className="size-5 text-status-critical" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
