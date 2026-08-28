import { createCrudRouter, prisma } from "../crud.js";

export const complaintRouter = createCrudRouter({
  entity: "complaint",
  delegate: prisma.complaint,
  orderBy: { requestDate: "desc" },
  treeIdFilter: true,
});
