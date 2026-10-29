import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,filter] duration-200 ease-out outline-none motion-reduce:transition-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        // Vermilion: at most one per screen, for the brand moment (activate, set up, publish).
        action: "neffi-cta bg-action text-white hover:bg-action-hover hover:text-white active:brightness-95 focus-visible:border-action focus-visible:ring-action/30 [&_svg]:text-white",
        outline:
          "neffi-cta-soft border-border bg-background hover:border-border-strong hover:bg-canvas hover:text-foreground active:bg-subtle aria-expanded:bg-canvas aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-subtle hover:text-foreground active:bg-subtle aria-expanded:bg-subtle aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/25 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        // Solid red for the confirming button of an irreversible action; hover deepens rather than fades.
        danger: "bg-destructive text-white hover:bg-[color-mix(in_oklch,var(--destructive),black_14%)] hover:text-white active:brightness-95 focus-visible:border-destructive focus-visible:ring-destructive/30 [&_svg]:text-white",
        link: "text-action-text underline-offset-4 hover:text-action-hover hover:underline",
      },
      size: {
        touch: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & {
  // Pending state: disables the button, shows a spinner and, when given, swaps the label for loadingText
  // without changing the button's width.
  loading?: boolean
  loadingText?: string
}

function Button({
  className,
  variant = "default",
  size = "default",
  loading,
  loadingText,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const hasLoadingState = loading !== undefined || loadingText !== undefined
  const isLoading = Boolean(loading)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }), isLoading && "disabled:opacity-100")}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {hasLoadingState ? (
        <span className="inline-grid gap-[inherit]">
          <span
            aria-hidden={isLoading || undefined}
            className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit]", isLoading && "invisible")}
          >
            {children}
          </span>
          <span
            aria-hidden={!isLoading || undefined}
            className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit]", !isLoading && "invisible")}
          >
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {loadingText ?? children}
          </span>
        </span>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
