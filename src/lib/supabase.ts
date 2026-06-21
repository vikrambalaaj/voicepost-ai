import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

// Fully lazy-evaluating Query Builder that mimics Supabase's exact promise chaining semantics 
// and stores data in a persistent local JSON file inside the scratch directory.
class MockSupabaseQueryBuilder {
  private tableName: string;
  private dbPath: string;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private actionValues: any = null;
  private upsertOptions: any = null;
  private filters: { column: string; value: any }[] = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private isSingle = false;

  constructor(tableName: string) {
    this.tableName = tableName;
    const isVercel = process.env.VERCEL === "1";
    this.dbPath = isVercel
      ? path.join("/tmp", "db.json")
      : path.join(process.cwd(), "scratch", "db.json");
    this.initDb();
  }

  private initDb() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let data: any = {};
    if (fs.existsSync(this.dbPath)) {
      try {
        data = JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
      } catch {}
    }
    if (!data.users || data.users.length === 0) {
      data.users = [
        {
          id: "f868e53c-80eb-4855-a289-e3cfe803ec33",
          email: "balamurugan@linkedinpost.com",
          full_name: "Bala J",
          industry: "SaaS & AI",
          region: "US",
          plan: "agency",
          posts_used_this_week: 0,
          posts_limit_weekly: 10,
          created_at: new Date().toISOString()
        }
      ];
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    }
  }

  select(columns?: string) {
    if (this.action === 'select') {
      this.action = 'select';
    }
    return this;
  }

  insert(values: any) {
    this.action = 'insert';
    this.actionValues = values;
    return this;
  }

  update(values: any) {
    this.action = 'update';
    this.actionValues = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.actionValues = values;
    this.upsertOptions = options;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  then(onfulfilled?: (value: any) => any) {
    try {
      const data = JSON.parse(fs.readFileSync(this.dbPath, "utf8"));
      let rows = data[this.tableName] || [];
      let resultData: any = null;

      if (this.action === 'select') {
        let filtered = [...rows];
        for (const filter of this.filters) {
          filtered = filtered.filter(row => row[filter.column] === filter.value);
        }
        if (this.orderCol) {
          filtered.sort((a, b) => {
            const valA = a[this.orderCol!];
            const valB = b[this.orderCol!];
            if (valA < valB) return this.orderAsc ? -1 : 1;
            if (valA > valB) return this.orderAsc ? 1 : -1;
            return 0;
          });
        }
        if (this.limitCount !== null) {
          filtered = filtered.slice(0, this.limitCount);
        }
        if (this.isSingle) {
          resultData = filtered[0] || null;
        } else {
          resultData = filtered;
        }
      } else if (this.action === 'insert') {
        const isArray = Array.isArray(this.actionValues);
        const itemsToInsert = isArray ? this.actionValues : [this.actionValues];
        const newItems = itemsToInsert.map((item: any) => {
          const newItem = { ...item };
          if (!newItem.id) {
            newItem.id = "mock_" + Math.random().toString(36).substring(2, 15);
          }
          if (!newItem.created_at) {
            newItem.created_at = new Date().toISOString();
          }
          return newItem;
        });
        rows = [...rows, ...newItems];
        data[this.tableName] = rows;
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        resultData = this.isSingle || !isArray ? newItems[0] : newItems;
      } else if (this.action === 'update') {
        const updatedRows = rows.map((row: any) => {
          let matches = true;
          for (const filter of this.filters) {
            if (row[filter.column] !== filter.value) {
              matches = false;
              break;
            }
          }
          if (matches) {
            return { ...row, ...this.actionValues, updated_at: new Date().toISOString() };
          }
          return row;
        });
        data[this.tableName] = updatedRows;
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));

        const matchingUpdated = updatedRows.filter((row: any) => {
          let matches = true;
          for (const filter of this.filters) {
            if (row[filter.column] !== filter.value) {
              matches = false;
              break;
            }
          }
          return matches;
        });
        resultData = this.isSingle ? matchingUpdated[0] || null : matchingUpdated;
      } else if (this.action === 'upsert') {
        const isArray = Array.isArray(this.actionValues);
        const itemsToUpsert = isArray ? this.actionValues : [this.actionValues];
        const conflictFields = ['id', 'user_id'];
        const upsertedItems = itemsToUpsert.map((item: any) => {
          const copy = { ...item };
          if (!copy.id) {
            copy.id = "mock_" + Math.random().toString(36).substring(2, 15);
          }
          if (!copy.created_at) {
            copy.created_at = new Date().toISOString();
          }
          return copy;
        });

        for (const item of upsertedItems) {
          const conflictIndex = rows.findIndex((row: any) => {
            if (row.industry !== undefined && item.industry !== undefined &&
                row.region !== undefined && item.region !== undefined) {
              return row.industry.toLowerCase() === item.industry.toLowerCase() &&
                     row.region.toLowerCase() === item.region.toLowerCase();
            }
            return conflictFields.every(field => row[field] === item[field] && item[field] !== undefined);
          });
          if (conflictIndex !== -1) {
            rows[conflictIndex] = { ...rows[conflictIndex], ...item, updated_at: new Date().toISOString() };
          } else {
            rows.push(item);
          }
        }
        data[this.tableName] = rows;
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        resultData = this.isSingle || !isArray ? upsertedItems[0] : upsertedItems;
      } else if (this.action === 'delete') {
        const remainingRows = rows.filter((row: any) => {
          let matches = true;
          for (const filter of this.filters) {
            if (row[filter.column] !== filter.value) {
              matches = false;
              break;
            }
          }
          return !matches;
        });
        data[this.tableName] = remainingRows;
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
        resultData = rows.filter((row: any) => {
          let matches = true;
          for (const filter of this.filters) {
            if (row[filter.column] !== filter.value) {
              matches = false;
              break;
            }
          }
          return matches;
        });
      }

      const res = { data: resultData, error: null };
      return Promise.resolve(res).then(onfulfilled);
    } catch (err: any) {
      const res = { data: null, error: { message: err.message } };
      return Promise.resolve(res).then(onfulfilled);
    }
  }
}

class MockSupabaseClient {
  from(tableName: string) {
    return new MockSupabaseQueryBuilder(tableName);
  }
  rpc(name: string, args?: any) {
    return Promise.resolve({ data: null, error: null });
  }
}

const isPlaceholder = !supabaseUrl || supabaseUrl.includes("placeholder-project") || supabaseUrl.includes("your-supabase-project");

const createProxiedClient = (client: any) => {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (tableName: string) => {
          if (tableName === "post_comments" || tableName === "trending_topics" || tableName === "users") {
            return new MockSupabaseQueryBuilder(tableName);
          }
          return target.from(tableName);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
};

const rawSupabase = isPlaceholder
  ? (new MockSupabaseClient() as any)
  : createClient(supabaseUrl, supabaseAnonKey);

export const supabase = isPlaceholder ? rawSupabase : createProxiedClient(rawSupabase);

export const getServiceSupabase = () => {
  if (isPlaceholder) {
    return new MockSupabaseClient() as any;
  }
  const rawService = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return createProxiedClient(rawService);
};
