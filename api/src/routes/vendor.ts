import { createCrudRouter, prisma } from "../crud.js";

export const vendorRouter = createCrudRouter({
  entity: "vendor",
  delegate: prisma.vendor,
  orderBy: { vendorName: "asc" },
});
