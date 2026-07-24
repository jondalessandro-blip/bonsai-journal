import { Router, type IRouter } from "express";
import healthRouter from "./health";
import treesRouter from "./trees";

const router: IRouter = Router();

router.use(healthRouter);
router.use(treesRouter);

export default router;
