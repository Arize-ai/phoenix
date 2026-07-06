CREATE TABLE `item_labels` (
	`item_id` integer NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`item_id`, `label`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `item_reactions` (
	`item_id` integer NOT NULL,
	`emoji` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`item_id`, `emoji`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_reactions_count_nonneg" CHECK("item_reactions"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`repo` text NOT NULL,
	`type` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`html_url` text NOT NULL,
	`author` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`needs_attention` integer NOT NULL,
	`reason` text NOT NULL,
	`last_actor` text,
	`last_actor_is_bot` integer NOT NULL,
	`last_actor_is_org_member` integer NOT NULL,
	`last_entry_at` text NOT NULL,
	`last_entry_url` text NOT NULL,
	`last_entry_excerpt` text NOT NULL,
	`has_assignee` integer NOT NULL,
	`assigned_to_me` integer NOT NULL,
	`review_requested_from_me` integer NOT NULL,
	`synced_at` text NOT NULL,
	CONSTRAINT "items_type_valid" CHECK("items"."type" in ('issue', 'pr', 'discussion'))
);
--> statement-breakpoint
CREATE INDEX `items_repo_idx` ON `items` (`repo`);--> statement-breakpoint
CREATE INDEX `items_needs_idx` ON `items` (`needs_attention`);--> statement-breakpoint
CREATE UNIQUE INDEX `items_repo_type_number` ON `items` (`repo`,`type`,`number`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `org_membership_cache` (
	`login` text PRIMARY KEY NOT NULL,
	`is_member` integer NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`login` text PRIMARY KEY NOT NULL
);
