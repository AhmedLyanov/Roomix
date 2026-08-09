import { cn } from "@/src/shared/lib";

type TypographyVariant =
  "h1" | "h2" | "h3" | "body" | "caption" | "label" | "navigation";

interface TypographyProps {
  children: React.ReactNode;
  variant?: TypographyVariant;
  className?: string;
}

const variants: Record<TypographyVariant, string> = {
  h1: "text-[36px] font-bold leading-tight ",
  h2: "text-4xl font-bold leading-tight",
  h3: "text-2xl font-semibold leading-snug",
  body: "text-[18px] font-regular text-(--color-gray)",
  caption: "font-normal text-[14px]",
  label: "text-sm font-regular text-[18px]",
  navigation:
    "text-[18px] font-bold leading-[100%] tracking-[0] text-(--color-gray) select-none",
};

export function Typography({
  children,
  variant = "body",
  className,
}: TypographyProps) {
  const Component = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    body: "p",
    caption: "span",
    label: "label",
    navigation: "span",
  }[variant] as React.ElementType;

  return (
    <Component className={cn(variants[variant], className)}>
      {children}
    </Component>
  );
}
