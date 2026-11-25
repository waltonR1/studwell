CREATE TABLE `admin_auth_logs` (
	`request_method` varchar(8),
	`route_template` varchar(160),
	`permission_code` varchar(80),
	`rate_limit_scope` varchar(40),
	`id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned,
	`username` varchar(64),
	`action` varchar(40) NOT NULL,
	`reason_code` varchar(40),
	`result` varchar(16) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`user_agent` varchar(256) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `admin_auth_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_dictionaries` (
	`id` bigint unsigned NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` varchar(300) NOT NULL DEFAULT '',
	`enabled` boolean NOT NULL DEFAULT true,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	CONSTRAINT `admin_dictionaries_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_dictionaries_code_unique` UNIQUE(`code`),
	CONSTRAINT `admin_dictionaries_code_canonical` CHECK(REGEXP_LIKE
(
`admin_dictionaries`.`code`,
'^[a-z][a-z0-9_]{2,63}$',
'c'
)),
	CONSTRAINT `admin_dictionaries_version_positive` CHECK(`admin_dictionaries`.`version`
> 0)
);
--> statement-breakpoint
CREATE TABLE `admin_dictionary_items` (
	`id` bigint unsigned NOT NULL,
	`dictionary_id` bigint unsigned NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`sort_order` int unsigned NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	CONSTRAINT `admin_dictionary_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_dictionary_items_code_unique` UNIQUE(`dictionary_id`,`code`),
	CONSTRAINT `admin_dictionary_items_code_canonical` CHECK(REGEXP_LIKE
(
`admin_dictionary_items`.`code`,
'^[a-z][a-z0-9_]{2,63}$',
'c'
))
);
--> statement-breakpoint
CREATE TABLE `admin_entity_id_counters` (
	`counter_key` varchar(10) NOT NULL,
	`sequence_value` int unsigned NOT NULL,
	CONSTRAINT `admin_entity_id_counters_counter_key` PRIMARY KEY(`counter_key`)
);
--> statement-breakpoint
CREATE TABLE `admin_menus` (
	`id` bigint unsigned NOT NULL,
	`parent_id` bigint unsigned,
	`code` varchar(64) NOT NULL,
	`page_key` varchar(64),
	`unique_binding_key` varchar(64) GENERATED ALWAYS AS (CASE WHEN page_key = 'website_page' THEN NULL ELSE page_key
    END) STORED,
	`name` varchar(80) NOT NULL,
	`icon_key` varchar(40) NOT NULL,
	`sort_order` int unsigned NOT NULL DEFAULT 0,
	`visible` boolean NOT NULL DEFAULT true,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	CONSTRAINT `admin_menus_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_menus_code_unique` UNIQUE(`code`),
	CONSTRAINT `admin_menus_page_unique` UNIQUE(`unique_binding_key`),
	CONSTRAINT `admin_menus_code_canonical` CHECK(REGEXP_LIKE
(
`admin_menus`.`code`,
'^[a-z][a-z0-9_]{2,63}$',
'c'
)),
	CONSTRAINT `admin_menus_version_positive` CHECK(`admin_menus`.`version`
> 0)
);
--> statement-breakpoint
CREATE TABLE `admin_operation_logs` (
	`change_context` json,
	`reason_code` varchar(40),
	`export_context` json,
	`cleanup_context` json,
	`id` bigint unsigned NOT NULL,
	`actor_id` bigint unsigned,
	`action` varchar(40) NOT NULL,
	`target_type` varchar(40) NOT NULL,
	`target_id` varchar(40),
	`target_name` varchar(80),
	`result` varchar(16) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`user_agent` varchar(256) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	CONSTRAINT `admin_operation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_parameters` (
	`id` bigint unsigned NOT NULL,
	`parameter_key` varchar(80) NOT NULL,
	`parameter_default_value` varchar(1024) NOT NULL,
	`parameter_value` varchar(1024),
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	CONSTRAINT `admin_parameters_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_parameters_key_unique` UNIQUE(`parameter_key`),
	CONSTRAINT `admin_parameters_version_positive` CHECK(`admin_parameters`.`version`
> 0)
);
--> statement-breakpoint
CREATE TABLE `admin_permissions` (
	`id` bigint unsigned NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(80) NOT NULL,
	`available` boolean NOT NULL DEFAULT false,
	CONSTRAINT `admin_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_permissions_code_unique` UNIQUE(`code`),
	CONSTRAINT `admin_permissions_code_canonical` CHECK(REGEXP_LIKE
(
`admin_permissions`.`code`,
'^[a-z][a-z0-9_.]{2,79}$',
'c'
))
);
--> statement-breakpoint
CREATE TABLE `admin_rate_limits` (
	`key` varchar(80) NOT NULL,
	`hits` int unsigned NOT NULL,
	`window_start` timestamp(3) NOT NULL,
	CONSTRAINT `admin_rate_limits_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `admin_role_menus` (
	`role_id` bigint unsigned NOT NULL,
	`menu_id` bigint unsigned NOT NULL,
	CONSTRAINT `admin_role_menus_role_id_menu_id_pk` PRIMARY KEY(`role_id`,`menu_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_role_permissions` (
	`role_id` bigint unsigned NOT NULL,
	`permission_id` bigint unsigned NOT NULL,
	CONSTRAINT `admin_role_permissions_role_id_permission_id_pk` PRIMARY KEY(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_roles` (
	`id` bigint unsigned NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	CONSTRAINT `admin_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_roles_code_unique` UNIQUE(`code`),
	CONSTRAINT `admin_roles_code_canonical` CHECK(REGEXP_LIKE
(
`admin_roles`.`code`,
'^[a-z][a-z0-9_]{2,63}$',
'c'
)),
	CONSTRAINT `admin_roles_version_positive` CHECK(`admin_roles`.`version`
> 0)
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`idle_timeout_ms` int unsigned NOT NULL,
	`id` bigint unsigned NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`user_id` bigint unsigned,
	`created_at` timestamp(3) NOT NULL,
	`last_activity_at` timestamp(3) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	CONSTRAINT `admin_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_sessions_token_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `admin_task_commands` (
	`id` bigint unsigned NOT NULL,
	`run_id` bigint unsigned NOT NULL,
	`token` varchar(36) NOT NULL,
	`action` varchar(10) NOT NULL,
	`created_at` timestamp(3) NOT NULL,
	`handled_at` timestamp(3),
	CONSTRAINT `admin_task_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_task_runs` (
	`id` bigint unsigned NOT NULL,
	`task_id` bigint unsigned NOT NULL,
	`token` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`trigger_type` varchar(20) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'queued',
	`snapshot` json NOT NULL,
	`counts` json NOT NULL,
	`attempt` int unsigned NOT NULL DEFAULT 0,
	`continuation` int unsigned NOT NULL DEFAULT 0,
	`created_by` bigint unsigned,
	`created_at` timestamp(3) NOT NULL,
	`started_at` timestamp(3),
	`finished_at` timestamp(3),
	`reason` varchar(40),
	`retry_at` timestamp(3),
	CONSTRAINT `admin_task_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_task_runs_request` UNIQUE(`request_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_tasks` (
	`id` bigint unsigned NOT NULL,
	`code` varchar(40) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`schedule` json NOT NULL,
	`retention` json,
	`version` int unsigned NOT NULL DEFAULT 1,
	`applied_version` int unsigned NOT NULL DEFAULT 0,
	`heartbeat_at` timestamp(3),
	`next_run_at` timestamp(3),
	`pending_trigger` varchar(20) NOT NULL DEFAULT 'startup',
	`pending_group_id` varchar(36),
	`pending_retry` int unsigned NOT NULL DEFAULT 0,
	`pending_continuation` int unsigned NOT NULL DEFAULT 0,
	`active_run_id` bigint unsigned,
	`active_token` varchar(36),
	`owner_id` varchar(36),
	`lease_until` timestamp(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_tasks_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `admin_user_roles` (
	`user_id` bigint unsigned NOT NULL,
	`role_id` bigint unsigned NOT NULL,
	CONSTRAINT `admin_user_roles_user_id_role_id_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` bigint unsigned NOT NULL,
	`username` varchar(64) NOT NULL,
	`display_name` varchar(80) NOT NULL,
	`email` varchar(254),
	`phone` varchar(32),
	`department` varchar(80),
	`position` varchar(80),
	`remark` varchar(500),
	`password_hash` varchar(255) NOT NULL,
	`is_root` boolean NOT NULL DEFAULT false,
	`root_slot` tinyint GENERATED ALWAYS AS (CASE WHEN is_root = 1 THEN 1 ELSE NULL
    END) STORED,
	`enabled` boolean NOT NULL DEFAULT true,
	`must_change_password` boolean NOT NULL DEFAULT true,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	`deleted_at` timestamp(3),
	`active_username` varchar(64) GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN username ELSE NULL
    END) STORED,
	CONSTRAINT `admin_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_users_username_unique` UNIQUE(`active_username`),
	CONSTRAINT `admin_users_single_root` UNIQUE(`root_slot`),
	CONSTRAINT `admin_users_username_canonical` CHECK(REGEXP_LIKE
    (
    `admin_users`.`username`,
    '^[a-z0-9_]{3,64}$',
    'c'
    )),
	CONSTRAINT `admin_users_root_identity` CHECK((`admin_users`.`is_root` = 1 AND `admin_users`.`username` = 'root' AND `admin_users`.`enabled` = 1 AND `admin_users`.`deleted_at` IS NULL)
                                           OR (
                                           `admin_users`.`is_root`
                                           =
                                           0
                                           AND
                                           `admin_users`.`username`
                                           <>
                                           'root'
                                           )),
	CONSTRAINT `admin_users_version_positive` CHECK(`admin_users`.`version`
    > 0)
);
--> statement-breakpoint
CREATE TABLE `career_position_releases` (
	`id` bigint unsigned NOT NULL,
	`position_id` bigint unsigned NOT NULL,
	`content` json NOT NULL,
	`sort_order` int unsigned NOT NULL,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `career_position_releases_id` PRIMARY KEY(`id`),
	CONSTRAINT `career_release_position_id` UNIQUE(`position_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `career_positions` (
	`id` bigint unsigned NOT NULL,
	`draft` json NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`published_release_id` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	CONSTRAINT `career_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_inquiries` (
	`id` bigint unsigned NOT NULL,
	`submission_key` varchar(36) NOT NULL,
	`category` varchar(16) NOT NULL,
	`locale` varchar(8) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`company` varchar(120) NOT NULL,
	`country` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`assignee_id` bigint unsigned,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_inquiries_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_inquiry_submission` UNIQUE(`submission_key`)
);
--> statement-breakpoint
CREATE TABLE `customer_inquiry_events` (
	`id` bigint unsigned NOT NULL,
	`inquiry_id` bigint unsigned NOT NULL,
	`actor_name` varchar(80) NOT NULL,
	`actor_id` bigint unsigned NOT NULL,
	`action` varchar(16) NOT NULL,
	`note` varchar(1000) NOT NULL DEFAULT '',
	`status` varchar(16),
	`assignee_name` varchar(80),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_inquiry_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_inquiry_mail` (
	`id` bigint unsigned NOT NULL,
	`inquiry_id` bigint unsigned NOT NULL,
	`kind` varchar(10) NOT NULL,
	`reply_cycle_id` bigint unsigned,
	`status` varchar(12) NOT NULL DEFAULT 'queued',
	`sender` varchar(254) NOT NULL,
	`recipient` varchar(254) NOT NULL,
	`reply_to` varchar(254) NOT NULL,
	`subject` varchar(150) NOT NULL,
	`body` text NOT NULL,
	`attempts` int unsigned NOT NULL DEFAULT 0,
	`available_at` timestamp(3) NOT NULL DEFAULT (now()),
	`sent_at` timestamp(3),
	`resolution` json,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_inquiry_mail_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_inquiry_settings` (
	`id` int unsigned NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`settings` json NOT NULL,
	`forward_template_defaults` json NOT NULL,
	CONSTRAINT `customer_inquiry_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` bigint unsigned NOT NULL,
	`storage_key` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`mime` varchar(80) NOT NULL,
	`size` int unsigned NOT NULL,
	`width` int unsigned,
	`height` int unsigned,
	`remark` varchar(1000) NOT NULL DEFAULT '',
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_storage_key_unique` UNIQUE(`storage_key`),
	CONSTRAINT `media_version_positive` CHECK(`media_assets`.`version` > 0)
);
--> statement-breakpoint
CREATE TABLE `media_references` (
	`id` bigint unsigned NOT NULL,
	`media_id` bigint unsigned NOT NULL,
	`owner` varchar(160) NOT NULL,
	`field` varchar(80) NOT NULL,
	CONSTRAINT `media_references_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_reference_slot_unique` UNIQUE(`owner`,`field`)
);
--> statement-breakpoint
CREATE TABLE `news_articles` (
	`view_count` int unsigned NOT NULL DEFAULT 0,
	`id` bigint unsigned NOT NULL,
	`slug` varchar(64) NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`content` json NOT NULL,
	`draft_version` int unsigned NOT NULL DEFAULT 1,
	`state_version` int unsigned NOT NULL DEFAULT 1,
	`published_release_id` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `news_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_article_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `news_categories` (
	`id` bigint unsigned NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` json NOT NULL,
	`sort_order` int unsigned NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `news_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_category_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `news_operations` (
	`id` int unsigned NOT NULL,
	`view_count_enabled` boolean NOT NULL DEFAULT false,
	`version` int unsigned NOT NULL DEFAULT 1,
	CONSTRAINT `news_operations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news_releases` (
	`id` bigint unsigned NOT NULL,
	`article_id` bigint unsigned NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`content` json NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`draft_version` int unsigned NOT NULL,
	`display_date` varchar(10) NOT NULL,
	`featured` boolean NOT NULL,
	`featured_order` int unsigned NOT NULL,
	`restored_from` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `news_releases_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_release_article_id` UNIQUE(`article_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `website_drafts` (
	`resource_id` bigint unsigned NOT NULL,
	`settings_version` int unsigned NOT NULL DEFAULT 1,
	`schema_version` int unsigned NOT NULL DEFAULT 1,
	`content` json NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_drafts_resource_id` PRIMARY KEY(`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `website_image_rules` (
	`id` tinyint unsigned NOT NULL,
	`rules` json NOT NULL,
	CONSTRAINT `website_image_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_language_config` (
	`id` int unsigned NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`languages` json NOT NULL,
	`published_release_id` bigint unsigned,
	CONSTRAINT `website_language_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_language_releases` (
	`id` bigint unsigned NOT NULL,
	`version` int unsigned NOT NULL,
	`content` json NOT NULL,
	`restored_from` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_language_releases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_module_policy` (
	`id` tinyint unsigned NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`policy` json NOT NULL,
	CONSTRAINT `website_module_policy_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_navigation` (
	`id` bigint unsigned NOT NULL,
	`resource_id` bigint unsigned NOT NULL,
	`kind` varchar(8) NOT NULL,
	`parent_id` bigint unsigned,
	`code` varchar(64) NOT NULL,
	`labels` json NOT NULL,
	`target_resource_id` bigint unsigned,
	`module` varchar(64) NOT NULL DEFAULT '',
	`target_type` varchar(24) NOT NULL DEFAULT 'page',
	`target_value` varchar(2000) NOT NULL DEFAULT '',
	`visible` boolean NOT NULL,
	`sort_order` int unsigned NOT NULL,
	CONSTRAINT `website_navigation_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_navigation_resource_id` UNIQUE(`resource_id`,`id`),
	CONSTRAINT `website_navigation_kind` CHECK(`website_navigation`.`kind` IN ('group','link'))
);
--> statement-breakpoint
CREATE TABLE `website_page_seo` (
	`resource_id` bigint unsigned NOT NULL,
	`locale` varchar(5) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` varchar(500) NOT NULL,
	`indexable` boolean NOT NULL DEFAULT true,
	`og_title` varchar(200) NOT NULL DEFAULT '',
	`og_description` varchar(500) NOT NULL DEFAULT '',
	`og_media_id` bigint unsigned,
	CONSTRAINT `website_page_seo_pk` PRIMARY KEY(`resource_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `website_published_routes` (
	`path` varchar(390) NOT NULL,
	`route_node_id` bigint unsigned,
	`resource_id` bigint unsigned NOT NULL,
	CONSTRAINT `website_published_routes_path` PRIMARY KEY(`path`),
	CONSTRAINT `website_published_route_target` UNIQUE(`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `website_published_seo` (
	`resource_id` bigint unsigned NOT NULL,
	`locale` varchar(5) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` varchar(500) NOT NULL,
	`indexable` boolean NOT NULL DEFAULT true,
	`og_title` varchar(200) NOT NULL DEFAULT '',
	`og_description` varchar(500) NOT NULL DEFAULT '',
	`og_media_id` bigint unsigned,
	CONSTRAINT `website_published_seo_pk` PRIMARY KEY(`resource_id`,`locale`)
);
--> statement-breakpoint
CREATE TABLE `website_releases` (
	`id` bigint unsigned NOT NULL,
	`resource_id` bigint unsigned NOT NULL,
	`snapshot_schema_version` int unsigned NOT NULL DEFAULT 1,
	`draft_version` int unsigned NOT NULL,
	`content` json NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`restored_from` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_releases_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_release_resource_id` UNIQUE(`resource_id`,`id`)
);
--> statement-breakpoint
CREATE TABLE `website_renderers` (
	`scope` varchar(8) NOT NULL,
	`renderer_key` varchar(100) NOT NULL,
	`component_path` varchar(512) NOT NULL,
	CONSTRAINT `website_renderers_scope_renderer_key_pk` PRIMARY KEY(`scope`,`renderer_key`)
);
--> statement-breakpoint
CREATE TABLE `website_resources` (
	`id` bigint unsigned NOT NULL,
	`resource_key` varchar(80) NOT NULL,
	`resource_type` varchar(8) NOT NULL,
	`state_version` int unsigned NOT NULL DEFAULT 1,
	`draft_version` int unsigned NOT NULL DEFAULT 1,
	`published_release_id` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_resource_key` UNIQUE(`resource_key`),
	CONSTRAINT `website_resource_type` CHECK(`website_resources`.`resource_type` IN ('basic','header','footer','page'))
);
--> statement-breakpoint
CREATE TABLE `website_route_nodes` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`parent_id` bigint unsigned,
	`slug` varchar(64) NOT NULL,
	`target_type` varchar(12) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`resource_id` bigint unsigned,
	`sort_order` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `website_route_nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_route_node_target` UNIQUE(`resource_id`)
);
--> statement-breakpoint
CREATE TABLE `website_sections` (
	`template_revision` int unsigned NOT NULL,
	`id` bigint unsigned NOT NULL,
	`resource_id` bigint unsigned NOT NULL,
	`template_id` bigint unsigned NOT NULL,
	`instance_name` varchar(100),
	`sort_order` int unsigned NOT NULL,
	`visible` boolean NOT NULL DEFAULT true,
	`anchor_key` varchar(64) NOT NULL,
	`shared_content` json NOT NULL,
	`localized_content` json NOT NULL,
	`content_version` int unsigned NOT NULL DEFAULT 1,
	`structure_version` int unsigned NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_section_anchor` UNIQUE(`resource_id`,`anchor_key`)
);
--> statement-breakpoint
CREATE TABLE `website_site_config` (
	`id` int unsigned NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`published_release_id` bigint unsigned,
	CONSTRAINT `website_site_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_site_config_releases` (
	`id` bigint unsigned NOT NULL,
	`version` int unsigned NOT NULL,
	`content` json NOT NULL,
	`restored_from` bigint unsigned,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_site_config_releases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `website_template_revisions` (
	`template_id` bigint unsigned NOT NULL,
	`version` int unsigned NOT NULL,
	`definition` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_template_revision_version` UNIQUE(`template_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `website_templates` (
	`preview_sample` json,
	`id` bigint unsigned NOT NULL,
	`cover_media_id` bigint unsigned,
	`template_key` varchar(100) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`description` varchar(1000) NOT NULL DEFAULT '',
	`enabled_for_new` boolean NOT NULL DEFAULT true,
	`metadata_version` int unsigned NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `website_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_template_key` UNIQUE(`template_key`)
);
--> statement-breakpoint
ALTER TABLE `admin_dictionaries` ADD CONSTRAINT `admin_dictionaries_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_dictionaries` ADD CONSTRAINT `admin_dictionaries_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_dictionary_items` ADD CONSTRAINT `admin_dictionary_items_dictionary_id_admin_dictionaries_id_fk` FOREIGN KEY (`dictionary_id`) REFERENCES `admin_dictionaries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_dictionary_items` ADD CONSTRAINT `admin_dictionary_items_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_dictionary_items` ADD CONSTRAINT `admin_dictionary_items_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_menus` ADD CONSTRAINT `admin_menus_parent_id_admin_menus_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `admin_menus`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_menus` ADD CONSTRAINT `admin_menus_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_menus` ADD CONSTRAINT `admin_menus_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_parameters` ADD CONSTRAINT `admin_parameters_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_parameters` ADD CONSTRAINT `admin_parameters_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_role_menus` ADD CONSTRAINT `admin_role_menus_role_id_admin_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_role_menus` ADD CONSTRAINT `admin_role_menus_menu_id_admin_menus_id_fk` FOREIGN KEY (`menu_id`) REFERENCES `admin_menus`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_role_id_admin_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_permission_id_admin_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `admin_permissions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_roles` ADD CONSTRAINT `admin_roles_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_roles` ADD CONSTRAINT `admin_roles_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_sessions` ADD CONSTRAINT `admin_sessions_user_id_admin_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_task_runs` ADD CONSTRAINT `admin_task_runs_task_id_admin_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `admin_tasks`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_user_id_admin_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_role_id_admin_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `admin_roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_users` ADD CONSTRAINT `admin_users_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_users` ADD CONSTRAINT `admin_users_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_position_releases` ADD CONSTRAINT `career_position_releases_position_id_career_positions_id_fk` FOREIGN KEY (`position_id`) REFERENCES `career_positions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_position_releases` ADD CONSTRAINT `career_position_releases_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_positions` ADD CONSTRAINT `career_positions_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_positions` ADD CONSTRAINT `career_positions_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `career_positions` ADD CONSTRAINT `career_position_publication` FOREIGN KEY (`id`,`published_release_id`) REFERENCES `career_position_releases`(`position_id`,`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_inquiries` ADD CONSTRAINT `customer_inquiries_assignee_id_admin_users_id_fk` FOREIGN KEY (`assignee_id`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_inquiry_events` ADD CONSTRAINT `customer_inquiry_events_inquiry_id_customer_inquiries_id_fk` FOREIGN KEY (`inquiry_id`) REFERENCES `customer_inquiries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_inquiry_events` ADD CONSTRAINT `customer_inquiry_events_actor_id_admin_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_inquiry_mail` ADD CONSTRAINT `customer_inquiry_mail_inquiry_id_customer_inquiries_id_fk` FOREIGN KEY (`inquiry_id`) REFERENCES `customer_inquiries`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_inquiry_mail` ADD CONSTRAINT `inquiry_mail_reply_cycle_fk` FOREIGN KEY (`reply_cycle_id`) REFERENCES `customer_inquiry_events`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_assets` ADD CONSTRAINT `media_assets_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_references` ADD CONSTRAINT `media_references_media_id_media_assets_id_fk` FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_category_id_news_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `news_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_articles_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_articles` ADD CONSTRAINT `news_article_publication` FOREIGN KEY (`id`,`published_release_id`) REFERENCES `news_releases`(`article_id`,`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_categories` ADD CONSTRAINT `news_categories_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_categories` ADD CONSTRAINT `news_categories_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_releases` ADD CONSTRAINT `news_releases_article_id_news_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `news_articles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_releases` ADD CONSTRAINT `news_releases_category_id_news_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `news_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_releases` ADD CONSTRAINT `news_releases_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `news_releases` ADD CONSTRAINT `news_release_source` FOREIGN KEY (`article_id`,`restored_from`) REFERENCES `news_releases`(`article_id`,`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_drafts` ADD CONSTRAINT `website_drafts_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_drafts` ADD CONSTRAINT `website_drafts_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_language_config` ADD CONSTRAINT `website_language_publication` FOREIGN KEY (`published_release_id`) REFERENCES `website_language_releases`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_language_releases` ADD CONSTRAINT `website_language_releases_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_navigation` ADD CONSTRAINT `website_navigation_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_navigation` ADD CONSTRAINT `website_navigation_parent` FOREIGN KEY (`resource_id`,`parent_id`) REFERENCES `website_navigation`(`resource_id`,`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_page_seo` ADD CONSTRAINT `website_page_seo_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_page_seo` ADD CONSTRAINT `website_page_seo_og_media_id_media_assets_id_fk` FOREIGN KEY (`og_media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_published_routes` ADD CONSTRAINT `website_published_routes_route_node_id_website_route_nodes_id_fk` FOREIGN KEY (`route_node_id`) REFERENCES `website_route_nodes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_published_routes` ADD CONSTRAINT `website_published_routes_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_published_seo` ADD CONSTRAINT `website_published_seo_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_published_seo` ADD CONSTRAINT `website_published_seo_og_media_id_media_assets_id_fk` FOREIGN KEY (`og_media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_releases` ADD CONSTRAINT `website_releases_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_releases` ADD CONSTRAINT `website_releases_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_releases` ADD CONSTRAINT `website_release_source` FOREIGN KEY (`resource_id`,`restored_from`) REFERENCES `website_releases`(`resource_id`,`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_resources` ADD CONSTRAINT `website_resources_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_resources` ADD CONSTRAINT `website_resources_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_resources` ADD CONSTRAINT `website_resource_publication` FOREIGN KEY (`id`,`published_release_id`) REFERENCES `website_releases`(`resource_id`,`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_route_nodes` ADD CONSTRAINT `website_route_nodes_parent_id_website_route_nodes_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `website_route_nodes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_route_nodes` ADD CONSTRAINT `website_route_nodes_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_sections` ADD CONSTRAINT `website_sections_resource_id_website_resources_id_fk` FOREIGN KEY (`resource_id`) REFERENCES `website_resources`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_sections` ADD CONSTRAINT `website_sections_template_id_website_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `website_templates`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_sections` ADD CONSTRAINT `website_sections_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_sections` ADD CONSTRAINT `website_sections_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_sections` ADD CONSTRAINT `website_section_template_revision` FOREIGN KEY (`template_id`,`template_revision`) REFERENCES `website_template_revisions`(`template_id`,`version`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_site_config` ADD CONSTRAINT `website_site_config_publication` FOREIGN KEY (`published_release_id`) REFERENCES `website_site_config_releases`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_site_config_releases` ADD CONSTRAINT `website_site_config_releases_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_template_revisions` ADD CONSTRAINT `website_template_revisions_template_id_website_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `website_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_templates` ADD CONSTRAINT `website_templates_cover_media_id_media_assets_id_fk` FOREIGN KEY (`cover_media_id`) REFERENCES `media_assets`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_templates` ADD CONSTRAINT `website_templates_created_by_admin_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `website_templates` ADD CONSTRAINT `website_templates_updated_by_admin_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `admin_users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_auth_logs_time` ON `admin_auth_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_auth_logs_request` ON `admin_auth_logs` (`request_id`);--> statement-breakpoint
CREATE INDEX `admin_auth_logs_user_time` ON `admin_auth_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_dictionary_items_order` ON `admin_dictionary_items` (`dictionary_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `admin_menus_parent_order` ON `admin_menus` (`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `admin_operation_logs_time` ON `admin_operation_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_operation_logs_request` ON `admin_operation_logs` (`request_id`);--> statement-breakpoint
CREATE INDEX `admin_operation_logs_actor_time` ON `admin_operation_logs` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_rate_limits_window` ON `admin_rate_limits` (`window_start`);--> statement-breakpoint
CREATE INDEX `admin_role_menus_menu` ON `admin_role_menus` (`menu_id`);--> statement-breakpoint
CREATE INDEX `admin_role_permissions_permission` ON `admin_role_permissions` (`permission_id`);--> statement-breakpoint
CREATE INDEX `admin_sessions_user` ON `admin_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `admin_sessions_expiry` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `admin_task_commands_pending` ON `admin_task_commands` (`run_id`,`handled_at`);--> statement-breakpoint
CREATE INDEX `admin_task_runs_task_time` ON `admin_task_runs` (`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `admin_task_runs_finished` ON `admin_task_runs` (`status`,`finished_at`);--> statement-breakpoint
CREATE INDEX `admin_user_roles_role` ON `admin_user_roles` (`role_id`);--> statement-breakpoint
CREATE INDEX `customer_inquiry_status` ON `customer_inquiries` (`status`,`id`);--> statement-breakpoint
CREATE INDEX `customer_inquiry_category` ON `customer_inquiries` (`category`,`id`);--> statement-breakpoint
CREATE INDEX `customer_inquiry_history` ON `customer_inquiry_events` (`inquiry_id`,`id`);--> statement-breakpoint
CREATE INDEX `customer_inquiry_mail_queue` ON `customer_inquiry_mail` (`status`,`kind`,`available_at`,`id`);--> statement-breakpoint
CREATE INDEX `customer_inquiry_mail_history` ON `customer_inquiry_mail` (`inquiry_id`,`id`);--> statement-breakpoint
CREATE INDEX `media_created` ON `media_assets` (`created_at`);--> statement-breakpoint
CREATE INDEX `media_reference_asset` ON `media_references` (`media_id`);--> statement-breakpoint
CREATE INDEX `news_article_category` ON `news_articles` (`category_id`);--> statement-breakpoint
CREATE INDEX `news_release_history` ON `news_releases` (`article_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `news_release_listing` ON `news_releases` (`category_id`,`display_date`);--> statement-breakpoint
CREATE INDEX `website_navigation_order` ON `website_navigation` (`resource_id`,`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `website_release_history` ON `website_releases` (`resource_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `website_route_parent` ON `website_route_nodes` (`parent_id`);--> statement-breakpoint
CREATE INDEX `website_section_order` ON `website_sections` (`resource_id`,`sort_order`);