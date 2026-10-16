import { useState } from "react";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StylePreviewImage } from "./StylePreviewImage";

const VISUAL_STYLES = [
  {
    group: "Featured",
    styles: ["Cinematic", "Cartoon", "Whiteboard", "AI Presenter", "Animated Podcast", "Single Scene"],
  },
  {
    group: "Realistic",
    styles: ["Cinematic Realistic", "Ultra Realistic", "Documentary", "Hollywood", "Horror Cinematic", "Romantic Cinematic", "35mm Film"],
  },
  {
    group: "Animation",
    styles: ["3D Animation", "3D Cartoon", "Pixar Style", "2D Cartoon", "Hand Drawn 2D Animation", "Anime", "Chibi", "Clay Stop Motion", "Storybook", "Watercolor", "Comic Book"],
  },
  {
    group: "Illustration",
    styles: ["Traditional Chinese Ink Painting", "Paper Cut Collage", "Colored Pencil Illustration", "Painterly Folklore"],
  },
  {
    group: "Stickman",
    styles: ["Classic Stickman", "Doodle Stickman", "Colorful Stickman", "Neon Stickman"],
  },
] as const;

interface ImageStylePickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function ImageStylePicker({
  value = "",
  onChange,
  label = "Image style",
  className,
}: ImageStylePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedStyle = value.trim();
  const hasStyle = selectedStyle.length > 0;

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {hasStyle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
          >
            <X className="size-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-xl border border-input bg-card p-2.5 text-left shadow-2xs transition-all hover:border-primary/50 hover:bg-card/90 hover:shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer sm:max-w-md",
          hasStyle && "border-primary/30 bg-primary/[0.02]"
        )}
      >
          {/* Small card thumbnail */}
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted shadow-2xs">
            <StylePreviewImage
              style={selectedStyle}
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/50 via-transparent to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Sparkles className="size-3 text-white" />
            </div>
          </div>

          {/* Style details */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold capitalize text-foreground">
                {hasStyle ? selectedStyle : "Select style"}
              </span>
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {hasStyle ? "Visual style for generated images" : "No style selected"}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
              <Sparkles className="size-3 shrink-0 text-primary/70" />
              <span>Click to choose from suggestions</span>
            </p>
          </div>

          {/* Right indicator */}
          <div className="shrink-0 pr-1 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary">
            <ChevronRight className="size-4" />
          </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="z-[70] flex w-[80vw] max-w-[80vw] max-h-[85vh] flex-col gap-3 overflow-y-auto rounded-2xl border bg-popover p-4 shadow-2xl sm:max-w-[80vw]"
          overlayClassName="z-[65] bg-black/60 backdrop-blur-xs"
        >
          {/* Popup Header */}
          <div className="flex items-start justify-between border-b border-border/60 pb-2 pr-8">
            <div>
              <DialogTitle className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" /> Visual Style
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                Choose one image style, or enter your own below
              </DialogDescription>
            </div>
          </div>

          {/* Custom style text field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">Current image style:</span>
              {hasStyle && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="text-[11px] text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Choose a visual style or enter your own..."
              className="h-8 font-mono text-xs"
            />
          </div>

          <div className="space-y-4 pt-1">
            {VISUAL_STYLES.map(({ group, styles }) => (
              <section key={group} className="space-y-2" aria-label={`${group} image styles`}>
                <h3 className="text-sm font-semibold text-foreground">{group}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {styles.map((style) => {
                    const active = selectedStyle.toLowerCase() === style.toLowerCase();
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => onChange(active ? "" : style)}
                        aria-pressed={active}
                        className={cn(
                          "group relative isolate block aspect-[16/10] overflow-hidden rounded-xl border text-left shadow-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary ring-2 ring-primary/70"
                            : "border-border/80 bg-card hover:border-primary/60 hover:shadow-md"
                        )}
                      >
                        <StylePreviewImage
                          style={style}
                          className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                        {active && (
                          <div className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="size-4 stroke-[3]" />
                          </div>
                        )}
                        <span
                          className="absolute right-3 bottom-3 left-3 text-base font-semibold leading-tight text-white drop-shadow-sm"
                          title={style}
                        >
                          {style}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-end border-t border-border/60 pt-2">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
