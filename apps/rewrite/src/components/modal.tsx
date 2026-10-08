import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRef, type ComponentProps } from "react";

/** Keep each workflow's authored layout, with one accessible modal boundary.
 * Close requests go through the caller so saving/dirty guards remain theirs. */
export function Modal({
  children,
  onClose,
  busy = false,
  title,
  ...props
}: Omit<ComponentProps<typeof DialogContent>, "title"> & {
  title: string;
  onClose: () => void;
  busy?: boolean;
}) {
  const previous = useRef(document.activeElement as HTMLElement | null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        layout="authored"
        showCloseButton={false}
        aria-describedby={undefined}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const active = document.activeElement;
          // Do not steal focus from a replacement modal or a deliberate editor focus.
          if (
            (active === document.body ||
              (event.target instanceof Element &&
                event.target.contains(active))) &&
            previous.current?.isConnected
          )
            previous.current.focus();
        }}
        {...props}
      >
        <DialogTitle asChild>
          <span className="sr-only">{title}</span>
        </DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
