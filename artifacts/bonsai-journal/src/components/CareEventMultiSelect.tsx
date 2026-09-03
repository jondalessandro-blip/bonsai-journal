import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CARE_EVENT_TYPES } from "@/lib/care-events";

interface CareEventMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export function CareEventMultiSelect({
  value,
  onChange,
  disabled = false,
}: CareEventMultiSelectProps) {
  const summary =
    value.length === 0
      ? "Select care events"
      : value.length === 1
        ? value[0]
        : `${value.length} events selected`;

  const toggleEvent = (event: string, checked: boolean) => {
    if (checked) {
      onChange(value.includes(event) ? value : [...value, event]);
    } else {
      onChange(value.filter((selected) => selected !== event));
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Select care events"
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className={value.length === 0 ? "text-muted-foreground" : ""}>
            {summary}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-56 p-2"
      >
        <div className="space-y-1" role="group" aria-label="Care events">
          {CARE_EVENT_TYPES.map((event) => (
            <label
              key={event}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={value.includes(event)}
                onCheckedChange={(checked) => toggleEvent(event, checked === true)}
              />
              <span>{event}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}