import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createInMemoryPrisma } from './in-memory-db.js';

let useMemoryFallback = false;
let memoryPrisma: any = null;

const realPrisma = new PrismaClient({
  log: [{ emit: 'stdout', level: 'error' }],
});

export const prisma = new Proxy(realPrisma as any, {
  get(target, prop: string) {
    if (useMemoryFallback) {
      if (!memoryPrisma) memoryPrisma = createInMemoryPrisma();
      return memoryPrisma[prop];
    }

    const orig = target[prop];
    if (typeof orig === 'function') {
      return (...args: any[]) => orig.apply(target, args);
    }

    if (typeof orig === 'object' && orig !== null) {
      return new Proxy(orig, {
        get(modelTarget, modelProp: string) {
          const modelMethod = modelTarget[modelProp];
          if (typeof modelMethod === 'function') {
            return async (...args: any[]) => {
              if (useMemoryFallback) {
                if (!memoryPrisma) memoryPrisma = createInMemoryPrisma();
                return memoryPrisma[prop][modelProp](...args);
              }
              try {
                return await modelMethod.apply(modelTarget, args);
              } catch (err: any) {
                if (
                  err?.message?.includes("Can't reach database server") ||
                  err?.name === 'PrismaClientInitializationError'
                ) {
                  logger.warn('PostgreSQL unreachable on localhost:5432, seamlessly falling back to in-memory store');
                  useMemoryFallback = true;
                  if (!memoryPrisma) memoryPrisma = createInMemoryPrisma();
                  return memoryPrisma[prop][modelProp](...args);
                }
                throw err;
              }
            };
          }
          return modelMethod;
        },
      });
    }

    return orig;
  },
});
