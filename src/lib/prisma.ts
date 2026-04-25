import { PrismaClient, Prisma } from "@prisma/client";

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

const prismaClientSingleton = () => {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          const scalarFields = (Prisma as any)[`${model}ScalarFieldEnum`];
          const hasDeletedAt = scalarFields && "deletedAt" in scalarFields;
          if (!hasDeletedAt || (args as any)?.where?.deletedAt !== undefined) {
            return query(args);
          }
          const finalArgs = args || {};
          finalArgs.where = { ...(finalArgs.where || {}), deletedAt: null };
          return query(finalArgs);
        },
        async findFirst({ model, args, query }) {
          const scalarFields = (Prisma as any)[`${model}ScalarFieldEnum`];
          const hasDeletedAt = scalarFields && "deletedAt" in scalarFields;
          if (!hasDeletedAt || (args as any)?.where?.deletedAt !== undefined) {
            return query(args);
          }
          const finalArgs = args || {};
          finalArgs.where = { ...(finalArgs.where || {}), deletedAt: null };
          return query(finalArgs);
        },
        async findUnique({ model, args, query }) {
          return query(args);
        },
        async count({ model, args, query }) {
          const scalarFields = (Prisma as any)[`${model}ScalarFieldEnum`];
          const hasDeletedAt = scalarFields && "deletedAt" in scalarFields;
          if (!hasDeletedAt || (args as any)?.where?.deletedAt !== undefined) {
            return query(args);
          }
          const finalArgs = args || {};
          finalArgs.where = { ...(finalArgs.where || {}), deletedAt: null };
          return query(finalArgs);
        },
      },
    },
    model: {
      $allModels: {
        async softDelete<T>(this: T, id: string) {
          const context = Prisma.getExtensionContext(this);
          return (context as any).update({
            where: { id },
            data: { deletedAt: new Date() },
          });
        },
      },
    },
  });
};


type PrismaClientType = ReturnType<typeof prismaClientSingleton>;

declare global {
  var prisma: PrismaClientType | undefined;
}

export const prisma = global.prisma || prismaClientSingleton();
export { basePrisma };

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
