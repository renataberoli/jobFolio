import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const applications = sqliteTable("applications", {
 id: text("id").primaryKey(), owner: text("owner").notNull(), role: text("role").notNull(), company: text("company").notNull(), url: text("url").notNull(), salary: text("salary"), status: text("status").notNull().default("Saved"), notes: text("notes"), cvKey: text("cv_key").notNull(), cvName: text("cv_name").notNull(), letterKey: text("letter_key").notNull(), letterName: text("letter_name").notNull(), createdAt: text("created_at").notNull()
}, (t) => [index("applications_owner_idx").on(t.owner)]);
