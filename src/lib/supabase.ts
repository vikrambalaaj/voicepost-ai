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
    let updated = false;
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
      updated = true;
    }
    if (!data.linkedin_accounts || data.linkedin_accounts.length === 0) {
      data.linkedin_accounts = [
        {
          id: "mock_account_john_doe",
          user_id: "f868e53c-80eb-4855-a289-e3cfe803ec33",
          linkedin_profile_id: "urn:li:person:mock_john_doe",
          access_token: "mock_token_xyz123",
          profile_name: "Bala J (Personal Profile)",
          profile_headline: "Tech Founder | Building AI automation for creators",
          profile_picture_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
          profile_email: "balamurugan@linkedinpost.com",
          scraping_status: "complete",
          is_primary: true,
          account_type: "personal",
          created_at: new Date().toISOString()
        },
        {
          id: "mock_account_scaleup",
          user_id: "f868e53c-80eb-4855-a289-e3cfe803ec33",
          linkedin_profile_id: "urn:li:organization:mock_scaleup_solutions",
          access_token: "mock_token_xyz123",
          profile_name: "ScaleUp Solutions (Company Page)",
          profile_headline: "LinkedIn Company Page",
          profile_picture_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&auto=format&fit=crop&q=60",
          profile_email: "balamurugan@linkedinpost.com",
          scraping_status: "complete",
          is_primary: false,
          account_type: "organization",
          created_at: new Date().toISOString()
        },
        {
          id: "mock_account_cloudnative",
          user_id: "f868e53c-80eb-4855-a289-e3cfe803ec33",
          linkedin_profile_id: "urn:li:organization:mock_cloudnative_inc",
          access_token: "mock_token_xyz123",
          profile_name: "CloudNative Inc (Company Page)",
          profile_headline: "LinkedIn Company Page",
          profile_picture_url: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=60",
          profile_email: "balamurugan@linkedinpost.com",
          scraping_status: "complete",
          is_primary: false,
          account_type: "organization",
          created_at: new Date().toISOString()
        }
      ];
      updated = true;
    }
    if (!data.audit_logs) {
      data.audit_logs = [];
      updated = true;
    }
    if (updated) {
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
  return client;
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
