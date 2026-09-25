import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const helpSections = [
  {
    title: "What this app is for",
    body: "Bonsai Journal helps you keep track of your bonsai and pre-bonsai collection, what each tree is, how it's doing, when you last watered or fed it, and what it looked like over time. Most of us don't reliably remember what we did to get a good result, or why something didn't work out. Keeping a record of what you did and when means you can look back later and actually understand what worked, what didn't, or how you got a particular result. It's also a place to plan ahead, both the near term care and the longer term development of each tree, so nothing slips through the cracks.",
  },
  {
    title: "Your Collection page",
    body: "This is your home base, a grid of all your trees. Each card shows a cover photo and the tree's basic info. Tap a tree card to open its full detail page.",
  },
  {
    title: "Filtering your collection",
    body: "Use the filter options above the grid to narrow things down by climate, foliage type, growth stage, health status, or your own tags. Tap a filter to open its list of options, and choose whether you want to include only trees that match, or exclude trees that match, so you can show only trees in Development stage, or hide everything tagged sold. You can combine filters, and they'll narrow the list together. Your filters stay active as you move between trees and when you come back to the Collection page.",
  },
  {
    title: "Selecting multiple trees at once",
    body: "You can select more than one tree on the Collection page and apply care or a plan to all of them together, handy when a group of trees got the same treatment, like a round of feeding or moving a batch indoors for winter. Switch into selection mode, tap each tree you want to include, then choose Log Care or Plan from the selection toolbar. Fill it in once, and it applies to every tree you selected.",
  },
  {
    title: "Adding a tree",
    body: "Tap Add Tree and fill in what you know: name, species, style, stage, status, when you acquired it, and any notes. You don't need every field filled in to save it.",
  },
  {
    title: "The Species field",
    body: "As you type in the Species field, the app suggests matches so you don't have to remember exact names or spellings. Suggestions come from a built-in list of common bonsai species, plus any species you've already used elsewhere in your own collection. Pick one and it fills in Species for you, and if Name is still blank, it fills that in too using the common name. You can also just type a species name straight into the Name field, when you tap away, the app checks whether it matches a known species and offers to fill in Species for you. If Species already has something in it, changing Name won't overwrite it, that's on purpose, so the app never quietly changes something you've already set.",
  },
  {
    title: "A tree's detail page",
    body: "This is where you manage one tree. From here you can edit any of its info, set a cover photo, add photos to track its progress, log care, set reminders, and see a running journal of everything that's happened to the tree, newest first.",
  },
  {
    title: "Adding a photo",
    body: "Add a photo any time from a tree's detail page, it gets added to that tree's photo timeline. Tap any photo to set it as the cover photo shown on the Collection page.",
  },
  {
    title: "Logging care",
    body: "Tap Log Care, pick what you did such as watering, fertilizing, or pruning, add a date and any notes, and save. It shows up in that tree's journal.",
  },
  {
    title: "Setting reminders",
    body: "Reminders let you flag something to do in the future, like checking for pests in two weeks. Set a one-time reminder for something that only needs doing once, or make it recurring, such as watering every day or fertilizing every two weeks, and choose months to skip when the tree goes dormant for part of the year. They'll show up in the journal so you don't forget.",
  },
  {
    title: "Completing a scheduled task",
    body: "There are two ways to mark a planned task done. Tap the circle icon next to it in the journal for a one-tap shortcut, it logs the care and, if it's a recurring task, moves it forward to its next due date automatically. Or open the task by tapping its pencil icon, check Task completed, confirm the date it was actually done, and save. That same dialog also lets you Skip a recurring task instead, moving it to its next occurrence without logging any care.",
  },
  {
    title: "The Care Calendar",
    body: "The Care Calendar gives you a general month-by-month guide to typical bonsai care, based on where you live and what kinds of trees you grow. Open it from the menu, then pick your grow zone and the tree groups that match your collection, such as hardy deciduous trees, pines, junipers, or tropical trees. The calendar will show you, month by month, the kind of care those trees typically need, like watering changes, fertilizing, pruning, repotting, and wiring windows. It's a general guide, not an exact schedule for your specific trees, your own care logs and reminders are still the best record of what your trees actually need.",
  },
  {
    title: "Plant Another Tree and Add Duplicate Tree",
    body: "From a tree's detail page, these buttons let you start a new tree entry pre-filled with that tree's info, handy for trees from the same batch or with similar care needs.",
  },
  {
    title: "Tags",
    body: "Tags are yours to define, there's no fixed list. Assign any label that makes sense to you, like yamadori, workshop 2026, or sold, so you can quickly find or group trees later using words that actually mean something to you, not just the built-in fields like stage or status. To add a tag, open a tree's info when adding or editing it and type the tag into the tags field, you can add as many as you like to a single tree. To filter by tag, use the tag filter on the Collection page the same way you'd filter by climate or stage: pick one or more tags, and choose whether to show only trees with those tags or hide them.",
  },
  {
    title: "Installing the app on your phone or computer",
    body: "Bonsai Journal can be installed like an app right from your web browser, no app store needed. On an iPhone or iPad, open the app in Safari, it has to be Safari and not Chrome, then tap the Share button, scroll down and tap Add to Home Screen, then tap Add. It'll show up on your home screen and open full screen like a regular app. On an Android phone, open the app in Chrome, tap the three dot menu, tap Install app or Add to Home screen, and confirm. On a computer using Chrome or Edge, look for an install icon in the address bar, a small monitor with a downward arrow or a plus sign, click it, then click Install, and it'll open in its own window that you can pin to your taskbar or dock. Once installed this way, it works the same as visiting it in the browser, same data, same login, just quicker to get to.",
  },
  {
    title: "If something looks off",
    body: "If a photo or field looks wrong or missing, try refreshing the page first. If it's still off, note what you saw and when, that's the fastest way to get it fixed.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <Link href="/">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Collection
        </Button>
      </Link>

      <div className="max-w-3xl">
        <h1 className="text-3xl font-serif text-foreground">Help</h1>

        <div className="mt-8 divide-y divide-border">
          {helpSections.map((section) => (
            <section
              key={section.title}
              className="space-y-3 py-6 first:pt-0 last:pb-0"
            >
              <h2 className="text-xl font-serif text-foreground">
                {section.title}
              </h2>
              <p className="text-muted-foreground leading-7">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}