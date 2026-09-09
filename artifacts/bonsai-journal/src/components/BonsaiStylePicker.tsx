import * as React from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/* ─── Data ─────────────────────────────────────────────────────────────────── */

export interface BonsaiStyle {
  value: string;        // stored string, e.g. "Chokkan (直幹) — Formal Upright"
  romanized: string;    // "Chokkan (直幹)"
  english: string;      // "Formal Upright"
  description: string;
}

interface StyleGroup {
  label: string;
  styles: BonsaiStyle[];
}

const STYLE_GROUPS: StyleGroup[] = [
  {
    label: "The Five Basic Styles — Trunk Inclination",
    styles: [
      {
        value: "Chokkan (直幹) — Formal Upright",
        romanized: "Chokkan (直幹)",
        english: "Formal Upright",
        description: "A perfectly straight, vertical trunk that tapers cleanly from the thick base to the top. Every branch and the apex are in perfect alignment. Considered the most difficult style to execute well because any flaw in the trunk is immediately visible.",
      },
      {
        value: "Moyogi (模様木) — Informal Upright",
        romanized: "Moyogi (模様木)",
        english: "Informal Upright",
        description: "A vertical tree featuring a curved trunk shaped like a soft 'S', with branches growing from the outer curves. The most common bonsai style, reflecting the natural growth patterns seen in many outdoor trees.",
      },
      {
        value: "Shakan (斜幹) — Slanting",
        romanized: "Shakan (斜幹)",
        english: "Slanting",
        description: "A straight or slightly curved trunk that leans at an angle of approximately 60 to 80 degrees from horizontal. Suggests a tree growing on a wind-exposed slope, with roots often developed more on one side for visual balance.",
      },
      {
        value: "Kengai (懸崖) — Cascade",
        romanized: "Kengai (懸崖)",
        english: "Cascade",
        description: "A dramatic style where the apex grows below the bottom rim of the pot, mimicking a tree hanging from a cliff edge. The cascading trunk requires a tall, deep pot to accommodate the downward growth.",
      },
      {
        value: "Han-Kengai (半懸崖) — Semi-Cascade",
        romanized: "Han-Kengai (半懸崖)",
        english: "Semi-Cascade",
        description: "Similar to Cascade, but the trunk grows horizontally or slightly downward without dropping below the bottom of the pot. Suggests a tree leaning over a riverbank or rocky ledge.",
      },
    ],
  },
  {
    label: "Multiple-Trunk Styles",
    styles: [
      {
        value: "Sokan (双幹) — Twin Trunk",
        romanized: "Sokan (双幹)",
        english: "Twin Trunk",
        description: "Two distinct trunks growing from a single root system, usually with one dominant, larger trunk. The two trunks share the same nebari and complement each other without overlapping in their branch structures.",
      },
      {
        value: "Sankan (三幹) — Triple Trunk",
        romanized: "Sankan (三幹)",
        english: "Triple Trunk",
        description: "Three trunks growing from a single root system. Like all odd-number trunk styles, three trunks create a more natural, asymmetric composition than an even number would.",
      },
      {
        value: "Gokan (五幹) — Five Trunk",
        romanized: "Gokan (五幹)",
        english: "Five Trunk",
        description: "Five trunks growing from a single root system. The five trunks vary in height and thickness, arranged to suggest a grove emerging from one root mass.",
      },
      {
        value: "Kabudachi (株立ち) — Clump",
        romanized: "Kabudachi (株立ち)",
        english: "Clump",
        description: "Three or more — always an odd number — trunks growing from one shared root base. Unlike Sokan and Sankan, Kabudachi often emerges from a central, visible stump and can have many more trunks.",
      },
      {
        value: "Yose-ue (寄せ植え) — Forest",
        romanized: "Yose-ue (寄せ植え)",
        english: "Forest",
        description: "Multiple individual trees planted together in one shallow pot to create a miniature woodland scene. Trees vary in height and thickness; odd numbers are preferred, and all trunks remain visually distinct.",
      },
    ],
  },
  {
    label: "Advanced and Scenic Styles",
    styles: [
      {
        value: "Bunjingi (文人木) — Literati",
        romanized: "Bunjingi (文人木)",
        english: "Literati",
        description: "A tall, thin, twisting trunk with minimal foliage concentrated only at the very top, intended to evoke the abstract, spare quality of East Asian calligraphy and ink painting. Named after the scholarly artist-poets of China who developed this aesthetic.",
      },
      {
        value: "Fukinagashi (吹流し) — Windswept",
        romanized: "Fukinagashi (吹流し)",
        english: "Windswept",
        description: "The trunk and all branches bend distinctly in one direction, as if shaped by constant strong winds over many years. Even the roots on the windward side may be exposed, reinforcing the visual story of struggle and endurance.",
      },
      {
        value: "Hokidachi (箒立ち) — Broom",
        romanized: "Hokidachi (箒立ち)",
        english: "Broom",
        description: "A straight, upright trunk whose branches all fan out symmetrically from a single point near the top, forming a rounded, dome-like crown. Closely modelled on deciduous trees such as zelkova, and particularly striking in winter when the fine branch structure is visible.",
      },
      {
        value: "Sekijoju (石上樹) — Root-over-Rock",
        romanized: "Sekijoju (石上樹)",
        english: "Root-over-Rock",
        description: "The tree's roots wrap tightly and dramatically around a rock before descending into the potting soil below. Over time the roots grip and conform to the rock's surface, creating a powerful, ancient appearance.",
      },
      {
        value: "Ishizuki (石付き) — Growing-in-a-Rock",
        romanized: "Ishizuki (石付き)",
        english: "Growing-in-a-Rock",
        description: "The tree is planted inside a hollow or natural crevice in a rock, with its roots contained within the stone itself rather than open soil. The rock becomes the planting container, creating a self-contained landscape composition.",
      },
      {
        value: "Ikadabuki (筏吹き) — Raft",
        romanized: "Ikadabuki (筏吹き)",
        english: "Raft",
        description: "A style created by laying a trunk horizontally on the soil so that its existing side branches — now pointing upward — grow to resemble individual trees in a grove. The buried trunk develops roots along its underside, supplying all of the upright branches.",
      },
      {
        value: "Sharimiki (舎利幹) — Driftwood",
        romanized: "Sharimiki (舎利幹)",
        english: "Driftwood",
        description: "A tree with large sections of dead, stripped, bleached wood — called shari — along its trunk and major branches, suggesting a tree that has survived intense hardship. The contrast between living bark and silvered deadwood is central to the style's dramatic beauty.",
      },
    ],
  },
];

// Flat list for lookup
const ALL_STYLES: BonsaiStyle[] = STYLE_GROUPS.flatMap((g) => g.styles);

function findStyle(value: string | undefined): BonsaiStyle | undefined {
  if (!value) return undefined;
  return ALL_STYLES.find((s) => s.value === value);
}

/* ─── Description panel ─────────────────────────────────────────────────────── */

function DescriptionPanel({ style }: { style: BonsaiStyle | undefined }) {
  if (!style) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs text-center px-3">
        Select a style to see its description
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="font-medium text-sm leading-tight">{style.romanized}</p>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{style.english}</p>
      <p className="text-sm text-foreground/80 leading-relaxed pt-1">{style.description}</p>
    </div>
  );
}

/* ─── Sentinel value used to clear the selection ────────────────────────────── */
const CLEAR_VALUE = "__clear__";

/* ─── Main component ─────────────────────────────────────────────────────────── */

interface BonsaiStylePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Small ⓘ icon that lives in the label row (not next to the input).
 * Renders nothing when no style is selected so the label row height is constant.
 */
export function BonsaiStyleInfoButton({ value }: { value?: string }) {
  const [open, setOpen] = React.useState(false);
  const style = findStyle(value);
  if (!style) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors leading-none"
          aria-label="View style description"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <DescriptionPanel style={style} />
      </PopoverContent>
    </Popover>
  );
}

export function BonsaiStylePicker({
  value,
  onChange,
  placeholder = "Select style (optional)",
}: BonsaiStylePickerProps) {
  const selected = findStyle(value);

  // Radix Select requires `undefined` (not "") to show the placeholder
  const selectValue = value || undefined;

  // Renders just the Select — identical structure to any other SelectTrigger in
  // the form so it aligns perfectly with adjacent fields like Foliage Type.
  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === CLEAR_VALUE ? "" : v)}
    >
      <SelectTrigger aria-label="Bonsai style">
        {selected ? (
          <span className="truncate">
            {selected.romanized} — {selected.english}
          </span>
        ) : value ? (
          <span className="truncate">{value}</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>

      <SelectContent
        className="max-h-[min(60vh,400px)]"
        style={{ maxWidth: "min(100vw - 32px, 480px)" }}
      >
        {/* Clear option */}
        <SelectItem value={CLEAR_VALUE} className="text-muted-foreground italic">
          — None —
        </SelectItem>

        {value && !selected && (
          <SelectItem value={value}>{value}</SelectItem>
        )}

        {STYLE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-xs px-2 py-1.5 text-muted-foreground/70">
              {group.label}
            </SelectLabel>
            {group.styles.map((style) => (
              <SelectItem
                key={style.value}
                value={style.value}
                className="cursor-pointer"
              >
                <span className="font-medium">{style.romanized}</span>
                <span className="text-muted-foreground ml-1.5 text-sm">— {style.english}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
