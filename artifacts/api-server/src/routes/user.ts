import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, treesTable, careLogsTable, careRemindersTable, treePhotosTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";

const router: IRouter = Router();

const SAMPLE_TREES: Array<{
  name: string;
  species: string;
  climate: string;
  foliage: string;
  style: string;
  stage: string;
  status: string;
  tags: string[];
  notes: string;
  acquiredDate?: string; // optional; entries that omit it receive `today` at seed time
  photoUrl: string;
  logs: Array<{ type: string; date: string; notes: string }>;
  reminders: Array<{ type: string; dueDate: string; notes: string }>;
}> = [
  {
    name: "Autumn Flame",
    species: "Acer palmatum",
    acquiredDate: "2023-03-15",
    climate: "Temperate",
    foliage: "Deciduous",
    style: "Informal Upright",
    stage: "Development",
    status: "Healthy",
    tags: ["maple", "sample"],
    photoUrl: "/sample-trees/maple.jpg",
    notes:
      "A sample tree to get you started. Japanese maples are prized for their delicate, star-shaped leaves and brilliant autumn colour. Feel free to delete this and add your own trees.",
    logs: [
      { type: "Repotting", date: "2024-03-10", notes: "Repotted into a shallower training pot with akadama mix." },
      { type: "Pruning", date: "2024-05-01", notes: "Light structural pruning to encourage back-budding." },
      { type: "Watering", date: "2024-06-15", notes: "Increased watering frequency as summer heat picks up." },
    ],
    reminders: [
      { type: "Repotting", dueDate: "2025-03-01", notes: "Check root mass — may be time to repot again." },
      { type: "Fertilising", dueDate: "2025-04-15", notes: "Apply balanced fertiliser as buds break." },
    ],
  },
  {
    name: "Old Silver",
    species: "Juniperus chinensis",
    acquiredDate: "2022-07-20",
    climate: "Temperate",
    foliage: "Evergreen",
    style: "Literati",
    stage: "Refinement",
    status: "Healthy",
    tags: ["juniper", "sample"],
    photoUrl: "/sample-trees/juniper.jpg",
    notes:
      "A sample tree to show the journal in action. Chinese junipers are one of the most popular bonsai species — forgiving, vigorous, and beautiful year-round. Feel free to delete this and add your own trees.",
    logs: [
      { type: "Wiring", date: "2024-01-20", notes: "Wired primary and secondary branches; will check for wire bite in 3 months." },
      { type: "Pruning", date: "2024-04-05", notes: "Pinched new growth to maintain silhouette." },
      { type: "Deadwood", date: "2024-07-12", notes: "Applied lime sulphur to existing jin." },
    ],
    reminders: [
      { type: "Wire check", dueDate: "2025-04-20", notes: "Check for wire bite on primary branches — remove or replace as needed." },
      { type: "Pruning", dueDate: "2025-06-01", notes: "Pinch new foliage pads to refine ramification." },
    ],
  },
  {
    name: "Little Red",
    species: "Juniperus virginiana",
    // acquiredDate omitted — resolved to `today` at seed time
    climate: "Hardy / Outdoor",
    foliage: "Conifer",
    style: "Moyogi (模様木) — Informal Upright",
    stage: "Trunk Development",
    status: "Thriving",
    tags: ["juniper", "sample", "native"],
    photoUrl: "/sample-trees/cedar.jpg",
    notes: `**Eastern Red Cedar** *Juniperus virginiana* — not a true cedar, it's a juniper. Evergreen scale/juvenile needle foliage, extremely tough, long-lived, and one of the best native North American species for bonsai, but with its own rules.

This is a dry, sunny, alkaline, poor-soil pioneer. Treat it like a juniper, not like your maples or figs.

### Light
Full sun, absolute maximum — 8+ hours direct. Will not survive indoors, not even briefly. Shade produces weak, leggy juvenile foliage that never transitions to mature scale.

### Watering & Soil
Drought tolerant once established. Let the top 2-3cm dry between waterings, then soak thoroughly — overwatering kills faster than underwatering. Neutral to alkaline soil (pH 6.5-8.0). Classic juniper mix: 50% akadama + 25% pumice + 25% lava rock, or 1:1:1 akadama/pumice/lava. Must drain instantly.

### Pruning
Never treat like a larch — junipers die if stripped bare. Let this year's growth run wild to thicken the trunk; heavy structural work waits for late fall through early spring. Always leave green on a branch — this species rarely buds back from bare old wood.

### Repotting
Hates root disturbance — the most sensitive species in this collection. Young trees: every 2-3 years, in early-mid spring or September. Never bare-root, never remove more than 30-40% of the root mass.

### Winter Care
Hardy to Zone 2-3. Needs a real outdoor dormancy — never bring it inside. Protect roots from repeated freeze/thaw below -15°C by burying the pot to its rim or storing in an unheated garage with light.

### Disease Watch
Alternate host for cedar-apple rust. Remove orange jelly galls by hand in spring if apples, crabapples, or serviceberry grow nearby.

**This is a long-term project tree.** Spend this first year building roots and trunk in a large grow pot, full sun, limestone grit. Next fall: select the trunk line, consider a jin from the sacrifice apex, and start wiring primary branches while the structure is still visible.`,
    logs: [],
    reminders: [],
  },
];

router.post("/user/seed", requireAuth, async (req: Request, res) => {
  const userId = (req as AuthedRequest).userId;

  // Count trees for this user — only seed if they have none
  const [{ value: treeCount }] = await db
    .select({ value: count() })
    .from(treesTable)
    .where(eq(treesTable.userId, userId));

  if (Number(treeCount) > 0) {
    res.json({ seeded: false, message: "User already has trees" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  for (const sample of SAMPLE_TREES) {
    const { logs, reminders, ...treeData } = sample;
    const acquiredDate = treeData.acquiredDate ?? today;

    const [tree] = await db
      .insert(treesTable)
      .values({ ...treeData, acquiredDate, userId })
      .returning();

    // Insert a cover photo so the tree detail hero shows the sample image
    await db.insert(treePhotosTable).values({
      treeId: tree.id,
      photoUrl: treeData.photoUrl,
      takenAt: acquiredDate,
    });

    if (logs.length > 0) {
      await db.insert(careLogsTable).values(
        logs.map((l) => ({ treeId: tree.id, ...l })),
      );
    }

    if (reminders.length > 0) {
      await db.insert(careRemindersTable).values(
        reminders.map((r) => ({ treeId: tree.id, ...r })),
      );
    }
  }

  res.json({ seeded: true, message: `Seeded ${SAMPLE_TREES.length} sample trees` });
});

export default router;
