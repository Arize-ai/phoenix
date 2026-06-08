CREATE TABLE `items` (
	`uid` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`html_url` text NOT NULL,
	`author` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	`comments_count` integer NOT NULL,
	`labels` text NOT NULL,
	`needs_attention` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`last_actor` text,
	`last_actor_is_team` integer NOT NULL,
	`last_actor_is_bot` integer NOT NULL,
	`last_actor_is_org_member` integer DEFAULT 0 NOT NULL,
	`assigned_to_me` integer DEFAULT 0 NOT NULL,
	`review_requested_from_me` integer DEFAULT 0 NOT NULL,
	`last_entry_at` text,
	`last_entry_url` text,
	`last_entry_excerpt` text,
	`last_entry_kind` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_cache` (
	`login` text PRIMARY KEY NOT NULL,
	`is_member` integer NOT NULL,
	`checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
