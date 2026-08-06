import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, treesTable, careLogsTable, careRemindersTable } from "@workspace/db";
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
  acquiredDate: string;
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

    const [tree] = await db
      .insert(treesTable)
      .values({ ...treeData, userId })
      .returning();

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
