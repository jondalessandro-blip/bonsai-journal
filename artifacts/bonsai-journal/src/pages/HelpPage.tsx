import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const helpSections: Array<{ title: string; body: string; extraParagraphs?: string[] }> = [
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
    body: "You can select more than one tree on the Collection page and apply care or a plan to all of them together, handy when a group of trees got the same treatment, like a round of feeding or moving a batch indoors for winter. Switch into selection mode, tap each tree you want to include, then choose Log Care or Plan from the selection toolbar. Fill it in once, and it applies to every tree you selected. Plans made this way are one time tasks. When they come due, you can finish many of them together from the Upcoming Care box, as described in Completing many scheduled tasks at once.",
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
    body: "Add a photo any time from a tree's detail page, it gets added to that tree's photo timeline. Photos are arranged by the date taken, oldest first. A new photo gets today's date, but you can change it, which is handy when you're adding older photos: tap the date under a photo, pick the right day, and save, and the photo moves to its proper place in the timeline. To make a photo the cover shown on the Collection page, tap the star on it. Tap the photo itself to open it full screen, where you can zoom in and out and add a note about what was going on, like a repotting or a round of pruning. Photos that have a note show a small note icon.",
  },
  {
    title: "Logging care",
    body: "Tap Log Care, pick what you did such as watering, fertilizing, or pruning, add a date and any notes, and save. It shows up in that tree's journal. If the same care was done to several trees, you don't have to log it one at a time. Select them on the Collection page and log it once for all of them, as described in Selecting multiple trees at once.",
  },
  {
    title: "Setting reminders",
    body: "Reminders let you flag something to do in the future, like checking for pests in two weeks. Set a one-time reminder for something that only needs doing once, or make it recurring, such as watering every day or fertilizing every two weeks, and choose months to skip when the tree goes dormant for part of the year. They'll show up in the journal so you don't forget. You can also plan a one time task for several trees at once by selecting them on the Collection page. Recurring plans are set up one tree at a time, so open the tree and set it there.",
  },
  {
    title: "Notifications",
    body: "Bonsai Journal can send you one notification each morning, around 8am Eastern time, telling you how many care tasks are due today and how many are overdue. If nothing is due, nothing is sent. An overdue task keeps being counted every day until you complete it or skip it, so the way to clear it is to deal with it. To turn notifications on, tap Notifications at the top of the screen, switch on Daily care notification on this device, and choose Allow when your browser asks. The setting is per device, so turn it on for each phone or computer where you want them, and turn it off the same way. Once it's on, tap Send test notification to check it's working, the test goes to every device you've turned on. On an iPhone or iPad, notifications only work from the installed app, so add Bonsai Journal to your Home Screen from Safari first, as described in Installing the app on your phone or computer, then open it from there and turn notifications on. On a Mac, if the test doesn't appear, open System Settings, go to Notifications, make sure every Google Chrome entry in the list is allowed, then quit Chrome completely and reopen it. Also check that Do Not Disturb or a Focus mode isn't on. If you chose Block by mistake, allow notifications for Bonsai Journal in your browser or device settings, then come back and switch it on.",
  },
  {
    title: "Completing a scheduled task",
    body: "There are two ways to mark a planned task done. Tap the circle icon next to it in the journal for a one-tap shortcut, it logs the care and, if it's a recurring task, moves it forward to its next due date automatically. Or open the task by tapping its pencil icon, check Task completed, confirm the date it was actually done, and save. That same dialog also lets you Skip a recurring task instead, moving it to its next occurrence without logging any care.",
  },
  {
    title: "Completing many scheduled tasks at once",
    extraParagraphs: [
      "In Select mode, Reschedule moves all ticked tasks to one new date, today or later. They stop showing as overdue and will come due on the new date.",
      "Repeating tasks: their future dates count from the new date. Often this changes nothing, for example, a weekly task moved by one week stays on the same day of the week. If it does throw off the rhythm, fix it after you do the task: open the tree page, choose Edit on the task, and change its next due date back to its usual day. For example, if you fertilize on the 15th of each month and move November's to the 22nd, the next one will be set for December 22. Change it to December 15 and it is back on schedule.",
    ],
    body: "When several trees have the same task due, you don't have to visit each one. On the Collection page, open the Upcoming Care box at the top and tap View all to see every overdue and upcoming task, then tap Select and tick the tasks you want to finish. To save time, tap a task type such as Fertilizing to tick every task of that type, or use the search box to narrow the list by tree name, task type, or notes, then tap Select all shown. At the bottom, choose which date to record. Done on lets you pick the day you actually did the work, today or any earlier day, and it applies to every task you ticked. On each task's scheduled date records each task on its own planned date instead, which is handy when you did everything on schedule but never marked it. Tasks that aren't due yet can't be recorded on their scheduled date, so the app unticks them and lets you know, and choosing Done on again brings them back. Tap Mark done, and if you picked more than one task you'll see a short summary to confirm first. Each task is handled the same way as the circle icon: the care is logged with its notes, a one time task is removed from your list, and a recurring task moves forward to its next due date. This only completes tasks exactly as planned. For care you didn't plan, go to the Collection page, select the trees, and choose Log Care.",
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
    title: "Archiving a tree",
    body: "Not every tree makes it, and some move on to a new home. Archiving lets you keep the full record of a tree while moving it out of your everyday collection. Open the tree, tap Archive, set the date, and if you like, pick a reason, such as Died, Failed seedling, Failed cutting, Failed layer, Failed graft, Gave away or sold, or Other, and add a note about what happened. Before you confirm, the app tells you how many planned reminders the tree has, because archiving removes them. Everything else stays: care history, photos, and notes, and the journal gets an Archived entry listing the plans that were removed. An archived tree no longer appears on the Collection page, in Upcoming Care, in your daily notification, or in your collection stats. To see archived trees, open Archive from the menu, and tap Open on any tree to view its full record. The Stats page also shows an Archive summary by year and by reason. If a tree comes back to life, or a sale falls through, open it and tap Restore. It returns to your collection with all its history, but its old reminders do not come back, so set new ones if you need them.",
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
              {section.extraParagraphs?.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground leading-7">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}