"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertCircle,
  Loader2,
} from "lucide-react";

type ToasterComponentProps = ToasterProps;

const Toaster = ({ ...props }: ToasterComponentProps) => {
  const { theme = "light" } = useTheme();

  return (
    <Sonner
      theme={(theme as ToasterProps["theme"]) || "light"}
      className="toaster group"
      closeButton
      icons={{
        success: <CheckCircle2 className="size-4 text-success" />,
        info: <Info className="size-4 text-info" />,
        warning: <AlertTriangle className="size-4 text-warning" />,
        error: <AlertCircle className="size-4 text-destructive" />,
        loading: <Loader2 className="size-4 animate-spin text-primary" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-xl, 0.75rem)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl text-body-sm",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium text-xs rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-medium text-xs rounded-lg",
          closeButton:
            "group-[.toast]:bg-popover group-[.toast]:border-border group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
