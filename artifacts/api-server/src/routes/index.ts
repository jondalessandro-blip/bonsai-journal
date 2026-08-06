import { Router, type IRouter } from "express";
import healthRouter from "./health";
import treesRouter from "./trees";
import storageRouter from "./storage";
import adminRouter from "./admin";
import userRouter from "./user";

const router: IRouter = Router();

router.use(healthRouter);
router.use(treesRouter);
router.use(storageRouter);
router.use(adminRouter);
router.use(userRouter);

export default router;
