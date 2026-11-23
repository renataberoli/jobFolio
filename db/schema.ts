import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const applications = sqliteTable("applications", {
 easyApply: integer("easy_apply", { mode: "boolean" }).notNull().default(false),
 manuallyApplied: integer("manually_applied", { mode: "boolean" }).notNull().default(false),
 id: text("id").primaryKey(), owner: text("owner").notNull(), role: text("role").notNull(), company: text("company").notNull(), url: text("url").notNull(), salary: text("salary"), status: text("status").notNull().default("Saved"), notes: text("notes"), cvKey: text("cv_key").notNull(), cvName: text("cv_name").notNull(), letterKey: text("letter_key").notNull(), letterName: text("letter_name").notNull(), createdAt: text("created_at").notNull()
}, (t) => [index("applications_owner_idx").on(t.owner)]);

export const profiles = sqliteTable("profiles", {
 id: text("id").primaryKey(),
 name: text("name").notNull(),
 createdAt: text("created_at").notNull(),
});
export const pinAttempts = sqliteTable("pin_attempts", {
 bucket: text("bucket").primaryKey(),
 attempts: integer("attempts").notNull().default(0),
 expiresAt: integer("expires_at").notNull(),
});
