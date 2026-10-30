CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_kind_owner` ON `records` (`kind`,`owner`);--> statement-breakpoint
CREATE INDEX `records_kind_target` ON `records` (`kind`,`target`);