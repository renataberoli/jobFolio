CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	`company` text NOT NULL,
	`url` text NOT NULL,
	`salary` text,
	`status` text DEFAULT 'Saved' NOT NULL,
	`notes` text,
	`cv_key` text NOT NULL,
	`cv_name` text NOT NULL,
	`letter_key` text NOT NULL,
	`letter_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `applications_owner_idx` ON `applications` (`owner`);