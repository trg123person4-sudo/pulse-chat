import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../utils/crypto.js';

export function createInMemoryPrisma() {
  const tables = new Map<string, Map<string, any>>();

  function getTable(name: string): Map<string, any> {
    let table = tables.get(name.toLowerCase());
    if (!table) {
      table = new Map<string, any>();
      tables.set(name.toLowerCase(), table);
    }
    return table;
  }

  function matchesWhere(item: any, where?: any): boolean {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (key === 'OR' && Array.isArray(val)) {
        if (!val.some((subWhere) => matchesWhere(item, subWhere))) return false;
        continue;
      }
      if (key === 'AND' && Array.isArray(val)) {
        if (!val.every((subWhere) => matchesWhere(item, subWhere))) return false;
        continue;
      }
      if (key === 'NOT') {
        if (matchesWhere(item, val)) return false;
        continue;
      }

      // Check if this key represents a Prisma compound unique index (e.g. senderId_clientMessageId, userId_conversationId)
      if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        const filterKeys = ['equals', 'not', 'in', 'contains', 'lt', 'lte', 'gt', 'gte', 'some'];
        const hasFilterKey = Object.keys(val).some((k) => filterKeys.includes(k));

        if (!hasFilterKey) {
          // Compound unique constraint object (e.g. { senderId, clientMessageId })
          for (const [subKey, subVal] of Object.entries(val)) {
            if (item[subKey] !== subVal) return false;
          }
          continue;
        }
      }

      const itemVal = item[key];
      if (val === null || val === undefined) {
        if (itemVal !== val) return false;
      } else if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        if ('equals' in val && itemVal !== val.equals) return false;
        if ('not' in val && itemVal === val.not) return false;
        if ('in' in val && Array.isArray(val.in) && !val.in.includes(itemVal)) return false;
        if ('contains' in val && typeof itemVal === 'string' && !itemVal.toLowerCase().includes(String(val.contains).toLowerCase())) return false;
        if ('lt' in val && !(itemVal < val.lt)) return false;
        if ('lte' in val && !(itemVal <= val.lte)) return false;
        if ('gt' in val && !(itemVal > val.gt)) return false;
        if ('gte' in val && !(itemVal >= val.gte)) return false;
        if ('some' in val) {
          // relation some check
          const relatedTable = getTable(key);
          const related = Array.from(relatedTable.values()).filter((r: any) => matchesWhere(r, val.some));
          if (related.length === 0) return false;
        }
      } else if (itemVal instanceof Date && val instanceof Date) {
        if (itemVal.getTime() !== val.getTime()) return false;
      } else if (itemVal !== val) {
        return false;
      }
    }
    return true;
  }

  function resolveIncludes(modelName: string, item: any, include?: any): any {
    if (!item || !include) return item;
    const resolved = { ...item };

    for (const [relKey, incVal] of Object.entries(include)) {
      if (!incVal) continue;
      if (relKey === 'user' && item.userId) {
        resolved.user = getTable('user').get(item.userId) || null;
      } else if (relKey === 'sender' && item.senderId) {
        resolved.sender = getTable('user').get(item.senderId) || null;
      } else if (relKey === 'conversation' && item.conversationId) {
        const conv = getTable('conversation').get(item.conversationId);
        resolved.conversation = conv ? resolveIncludes('conversation', conv, typeof incVal === 'object' ? incVal.include : undefined) : null;
      } else if (relKey === 'memberships' && item.id) {
        const members = Array.from(getTable('membership').values())
          .filter((m: any) => m.conversationId === item.id)
          .map((m: any) => resolveIncludes('membership', m, typeof incVal === 'object' ? incVal.include : undefined));
        resolved.memberships = members;
      } else if (relKey === 'messages' && item.id) {
        const msgs = Array.from(getTable('message').values())
          .filter((m: any) => m.conversationId === item.id)
          .map((m: any) => resolveIncludes('message', m, typeof incVal === 'object' ? incVal.include : undefined));
        resolved.messages = msgs;
      } else if (relKey === 'attachments' && item.id) {
        resolved.attachments = Array.from(getTable('attachment').values()).filter((a: any) => a.messageId === item.id);
      } else if (relKey === 'reactions' && item.id) {
        resolved.reactions = Array.from(getTable('reaction').values()).filter((r: any) => r.messageId === item.id);
      } else if (relKey === 'replyTo' && item.replyToId) {
        const parent = getTable('message').get(item.replyToId);
        resolved.replyTo = parent ? resolveIncludes('message', parent, typeof incVal === 'object' ? incVal.include : undefined) : null;
      } else if (relKey === 'savedBy' && item.id) {
        resolved.savedBy = Array.from(getTable('savedmessage').values()).filter((s: any) => s.messageId === item.id);
      }
    }
    return resolved;
  }

  function createModelHandler(modelName: string) {
    const table = getTable(modelName);

    return {
      async findFirst(args?: any) {
        const item = Array.from(table.values()).find((entry: any) => matchesWhere(entry, args?.where));
        return item ? resolveIncludes(modelName, item, args?.include) : null;
      },

      async findUnique(args: any) {
        let item = null;
        if (args?.where?.id) {
          item = table.get(args.where.id) || null;
        } else {
          item = Array.from(table.values()).find((entry: any) => matchesWhere(entry, args?.where)) || null;
        }
        return item ? resolveIncludes(modelName, item, args?.include) : null;
      },

      async findMany(args?: any) {
        let items = Array.from(table.values()).filter((entry: any) => matchesWhere(entry, args?.where));

        if (args?.orderBy) {
          const [orderKey, orderDir] = Object.entries(args.orderBy)[0] as [string, 'asc' | 'desc'];
          items.sort((a, b) => {
            const valA = a[orderKey];
            const valB = b[orderKey];
            if (valA < valB) return orderDir === 'desc' ? 1 : -1;
            if (valA > valB) return orderDir === 'desc' ? -1 : 1;
            return 0;
          });
        }

        if (args?.take !== undefined) {
          items = items.slice(0, args.take);
        }

        return items.map((item) => resolveIncludes(modelName, item, args?.include));
      },

      async create(args: any) {
        const id = args.data.id || uuidv4();
        const now = new Date();
        const record = {
          id,
          createdAt: now,
          updatedAt: now,
          ...args.data,
        };

        // Handle nested creation for refreshTokens
        if (record.refreshTokens?.create) {
          const rtTable = getTable('refreshtoken');
          const rtId = uuidv4();
          rtTable.set(rtId, {
            id: rtId,
            userId: id,
            createdAt: now,
            ...record.refreshTokens.create,
          });
          delete record.refreshTokens;
        }

        // Handle nested creation for memberships
        if (record.memberships?.create && Array.isArray(record.memberships.create)) {
          const memTable = getTable('membership');
          for (const m of record.memberships.create) {
            const mId = uuidv4();
            memTable.set(mId, {
              id: mId,
              conversationId: id,
              createdAt: now,
              joinedAt: now,
              ...m,
            });
          }
          delete record.memberships;
        }

        table.set(id, record);
        return resolveIncludes(modelName, record, args?.include);
      },

      async update(args: any) {
        let item = null;
        if (args?.where?.id) {
          item = table.get(args.where.id);
        } else {
          item = Array.from(table.values()).find((entry: any) => matchesWhere(entry, args?.where));
        }

        if (!item) throw new Error(`Record to update not found in ${modelName}`);

        const mergedData: any = {};
        for (const [k, v] of Object.entries(args.data || {})) {
          if (v && typeof v === 'object' && 'increment' in v) {
            mergedData[k] = (Number(item[k]) || 0) + Number((v as any).increment);
          } else if (v && typeof v === 'object' && 'decrement' in v) {
            mergedData[k] = (Number(item[k]) || 0) - Number((v as any).decrement);
          } else {
            mergedData[k] = v;
          }
        }

        const updated = {
          ...item,
          ...mergedData,
          updatedAt: new Date(),
        };
        table.set(updated.id, updated);
        return resolveIncludes(modelName, updated, args?.include);
      },

      async updateMany(args: any) {
        const items = Array.from(table.values()).filter((entry: any) => matchesWhere(entry, args?.where));
        for (const item of items) {
          const mergedData: any = {};
          for (const [k, v] of Object.entries(args.data || {})) {
            if (v && typeof v === 'object' && 'increment' in v) {
              mergedData[k] = (Number(item[k]) || 0) + Number((v as any).increment);
            } else if (v && typeof v === 'object' && 'decrement' in v) {
              mergedData[k] = (Number(item[k]) || 0) - Number((v as any).decrement);
            } else {
              mergedData[k] = v;
            }
          }
          const updated = { ...item, ...mergedData, updatedAt: new Date() };
          table.set(updated.id, updated);
        }
        return { count: items.length };
      },

      async delete(args: any) {
        let item = null;
        if (args?.where?.id) {
          item = table.get(args.where.id);
          table.delete(args.where.id);
        } else {
          item = Array.from(table.values()).find((entry: any) => matchesWhere(entry, args?.where));
          if (item) table.delete(item.id);
        }
        return item;
      },

      async deleteMany(args?: any) {
        const items = Array.from(table.values()).filter((entry: any) => matchesWhere(entry, args?.where));
        for (const item of items) {
          table.delete(item.id);
        }
        return { count: items.length };
      },

      async count(args?: any) {
        const items = Array.from(table.values()).filter((entry: any) => matchesWhere(entry, args?.where));
        return items.length;
      },

      async upsert(args: any) {
        let item = null;
        if (args?.where?.id) {
          item = table.get(args.where.id);
        } else {
          item = Array.from(table.values()).find((entry: any) => matchesWhere(entry, args?.where));
        }

        if (item) {
          const updated = { ...item, ...args.update, updatedAt: new Date() };
          table.set(updated.id, updated);
          return resolveIncludes(modelName, updated, args?.include);
        } else {
          const id = args.create.id || uuidv4();
          const now = new Date();
          const created = { id, createdAt: now, updatedAt: now, ...args.create };
          table.set(id, created);
          return resolveIncludes(modelName, created, args?.include);
        }
      },
    };
  }

  // Pre-seed default #general channel
  const convTable = getTable('conversation');
  convTable.set('conv_general', {
    id: 'conv_general',
    type: 'CHANNEL',
    name: 'general',
    topic: 'General discussion for everyone',
    isPrivate: false,
    disappearingAfterSeconds: null,
    archivedAt: null,
    createdById: 'system',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return new Proxy({} as any, {
    get(_target, prop: string) {
      if (prop === '$connect') return async () => {};
      if (prop === '$disconnect') return async () => {};
      if (prop === '$on') return () => {};
      if (prop === '$queryRaw') return async () => [];
      if (prop === '$executeRaw') return async () => 0;
      return createModelHandler(prop);
    },
  });
}
