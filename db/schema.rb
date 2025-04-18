# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20231030173246) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"
  enable_extension "btree_gin"

  create_table "activation_codes", force: :cascade do |t|
    t.string   "code_hash"
    t.string   "record_code"
    t.datetime "created_at",  null: false
    t.datetime "updated_at",  null: false
    t.index ["code_hash"], name: "index_activation_codes_on_code_hash", unique: true, using: :btree
  end

  create_table "api_calls", force: :cascade do |t|
    t.integer  "user_id"
    t.text     "data"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "audit_events", force: :cascade do |t|
    t.string   "user_key",   limit: 255
    t.text     "data"
    t.string   "summary",    limit: 4096
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "event_type", limit: 255
    t.string   "record_id"
    t.index ["event_type", "created_at"], name: "index_audit_events_on_event_type_and_created_at", using: :btree
    t.index ["event_type", "record_id"], name: "index_audit_events_on_event_type_and_record_id", using: :btree
    t.index ["user_key", "created_at"], name: "index_audit_events_on_user_key_and_created_at", using: :btree
  end

  create_table "board_button_images", force: :cascade do |t|
    t.integer  "button_image_id"
    t.integer  "board_id"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["board_id"], name: "index_board_button_images_on_board_id", using: :btree
    t.index ["button_image_id"], name: "index_board_button_images_on_button_image_id", using: :btree
  end

  create_table "board_button_sounds", force: :cascade do |t|
    t.integer  "button_sound_id"
    t.integer  "board_id"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["board_id"], name: "index_board_button_sounds_on_board_id", using: :btree
  end

  create_table "board_contents", force: :cascade do |t|
    t.text     "settings"
    t.integer  "board_count"
    t.integer  "source_board_id"
    t.datetime "created_at",      null: false
    t.datetime "updated_at",      null: false
  end

  create_table "board_downstream_button_sets", force: :cascade do |t|
    t.text     "data"
    t.integer  "board_id"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "user_id"
    t.index ["board_id", "user_id"], name: "index_board_downstream_button_sets_on_board_id_and_user_id", unique: true, using: :btree
  end

  create_table "board_locales", force: :cascade do |t|
    t.integer  "board_id"
    t.integer  "popularity"
    t.integer  "home_popularity"
    t.string   "locale"
    t.string   "search_string",     limit: 10000
    t.datetime "created_at",                      null: false
    t.datetime "updated_at",                      null: false
    t.tsvector "tsv_search_string"
    t.index "to_tsvector('simple'::regconfig, COALESCE((search_string)::text, ''::text))", name: "board_locales_search_string", using: :gin
    t.index ["tsv_search_string"], name: "index_board_locales_tsv_search_string", using: :gin
  end

  create_table "boards", force: :cascade do |t|
    t.string   "name",             limit: 255
    t.string   "key",              limit: 255
    t.string   "search_string",    limit: 4096
    t.boolean  "public"
    t.text     "settings"
    t.integer  "parent_board_id"
    t.integer  "user_id"
    t.integer  "popularity"
    t.integer  "home_popularity"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "current_revision", limit: 255
    t.boolean  "any_upstream"
    t.integer  "board_content_id"
    t.index "COALESCE(search_string, (''::text)::character varying)", name: "boards_search_string2", using: :gin
    t.index "to_tsvector('simple'::regconfig, COALESCE((search_string)::text, ''::text))", name: "boards_search_string", using: :gin
    t.index ["key"], name: "index_boards_on_key", unique: true, using: :btree
    t.index ["parent_board_id", "user_id"], name: "index_boards_on_parent_board_id_and_user_id", using: :btree
    t.index ["parent_board_id"], name: "index_boards_on_parent_board_id", using: :btree
    t.index ["public", "home_popularity", "popularity", "id"], name: "board_pop_index", using: :btree
    t.index ["public", "popularity", "home_popularity", "id"], name: "boards_all_pops", using: :btree
    t.index ["public", "user_id"], name: "index_boards_on_public_and_user_id", using: :btree
    t.index ["user_id", "popularity", "any_upstream", "id"], name: "board_user_index_popularity", using: :btree
  end

  create_table "button_images", force: :cascade do |t|
    t.integer  "board_id"
    t.integer  "remote_id"
    t.integer  "parent_button_image_id"
    t.integer  "user_id"
    t.boolean  "public"
    t.string   "path",                   limit: 255
    t.string   "url",                    limit: 4096
    t.text     "data"
    t.text     "settings"
    t.string   "file_hash",              limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "nonce",                  limit: 255
    t.boolean  "removable"
    t.index ["url"], name: "index_button_images_on_url", using: :btree
  end

  create_table "button_sounds", force: :cascade do |t|
    t.integer  "board_id"
    t.integer  "remote_id"
    t.integer  "user_id"
    t.boolean  "public"
    t.string   "path",       limit: 255
    t.string   "url",        limit: 4096
    t.text     "data"
    t.text     "settings"
    t.string   "file_hash",  limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "nonce",      limit: 255
    t.boolean  "removable"
    t.index ["file_hash"], name: "index_button_sounds_on_file_hash", using: :btree
    t.index ["removable"], name: "index_button_sounds_on_removable", using: :btree
    t.index ["url"], name: "index_button_sounds_on_url", using: :btree
  end

  create_table "cluster_locations", force: :cascade do |t|
    t.integer  "user_id"
    t.text     "data"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "cluster_type", limit: 255
    t.string   "cluster_hash", limit: 255
    t.index ["cluster_type", "cluster_hash"], name: "index_cluster_locations_on_cluster_type_and_hash", unique: true, using: :btree
  end

  create_table "contact_messages", force: :cascade do |t|
    t.text     "settings"
    t.datetime "created_at"
    t.datetime "updated_at"
  end

  create_table "deleted_boards", force: :cascade do |t|
    t.string   "key",        limit: 255
    t.text     "settings"
    t.integer  "board_id"
    t.integer  "user_id"
    t.boolean  "cleared"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["board_id"], name: "index_deleted_boards_on_board_id", using: :btree
    t.index ["created_at", "cleared"], name: "index_deleted_boards_on_created_at_and_cleared", using: :btree
    t.index ["key"], name: "index_deleted_boards_on_key", using: :btree
    t.index ["user_id"], name: "index_deleted_boards_on_user_id", using: :btree
  end

  create_table "developer_keys", force: :cascade do |t|
    t.string   "key",          limit: 255
    t.string   "redirect_uri", limit: 4096
    t.string   "name",         limit: 255
    t.string   "secret",       limit: 4096
    t.string   "icon_url",     limit: 4096
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["key"], name: "index_developer_keys_on_key", unique: true, using: :btree
  end

  create_table "devices", force: :cascade do |t|
    t.integer  "user_id"
    t.string   "device_key",          limit: 255
    t.text     "settings"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "developer_key_id"
    t.integer  "user_integration_id"
    t.index ["user_id"], name: "index_devices_on_user_id", using: :btree
  end

  create_table "external_nonces", force: :cascade do |t|
    t.string   "purpose"
    t.string   "nonce"
    t.string   "transform"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer  "uses"
  end

  create_table "gift_purchases", force: :cascade do |t|
    t.text     "settings"
    t.boolean  "active"
    t.string   "code",       limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["active", "code"], name: "index_gift_purchases_on_active_and_code", unique: true, using: :btree
  end

  create_table "job_stashes", force: :cascade do |t|
    t.text     "data"
    t.datetime "created_at",     null: false
    t.datetime "updated_at",     null: false
    t.integer  "log_session_id"
    t.integer  "user_id"
    t.index ["created_at"], name: "index_job_stashes_on_created_at", using: :btree
    t.index ["user_id", "log_session_id"], name: "index_job_stashes_on_user_id_and_log_session_id", using: :btree
  end

  create_table "lessons", force: :cascade do |t|
    t.text     "settings"
    t.integer  "user_id"
    t.integer  "organization_id"
    t.integer  "organization_unit_id"
    t.boolean  "public"
    t.integer  "popularity"
    t.datetime "created_at",           null: false
    t.datetime "updated_at",           null: false
  end

  create_table "library_caches", force: :cascade do |t|
    t.string   "library"
    t.string   "locale"
    t.text     "data"
    t.datetime "invalidated_at"
    t.datetime "created_at",     null: false
    t.datetime "updated_at",     null: false
    t.index ["library", "locale"], name: "index_library_caches_on_library_and_locale", unique: true, using: :btree
  end

  create_table "log_mergers", force: :cascade do |t|
    t.datetime "merge_at"
    t.boolean  "started"
    t.integer  "log_session_id"
    t.datetime "created_at",     null: false
    t.datetime "updated_at",     null: false
    t.index ["log_session_id"], name: "index_log_mergers_on_log_session_id", using: :btree
  end

  create_table "log_session_boards", force: :cascade do |t|
    t.integer  "log_session_id"
    t.integer  "board_id"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["board_id", "log_session_id"], name: "index_log_session_boards_on_board_id_and_log_session_id", using: :btree
  end

  create_table "log_sessions", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "author_id"
    t.integer  "device_id"
    t.datetime "started_at"
    t.datetime "ended_at"
    t.text     "data"
    t.boolean  "processed"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "ip_cluster_id"
    t.integer  "geo_cluster_id"
    t.string   "log_type",                limit: 255
    t.boolean  "has_notes"
    t.datetime "last_cluster_attempt_at"
    t.integer  "goal_id"
    t.boolean  "needs_remote_push"
    t.boolean  "highlighted"
    t.integer  "score"
    t.string   "profile_id"
    t.index ["author_id"], name: "index_log_sessions_on_author_id", using: :btree
    t.index ["device_id", "ended_at"], name: "index_log_sessions_on_device_id_and_ended_at", using: :btree
    t.index ["needs_remote_push", "ended_at"], name: "index_log_sessions_on_needs_remote_push_and_ended_at", using: :btree
    t.index ["started_at", "log_type"], name: "index_log_sessions_on_started_at_and_log_type", using: :btree
    t.index ["user_id", "goal_id"], name: "index_log_sessions_on_user_id_and_goal_id", using: :btree
    t.index ["user_id", "highlighted"], name: "index_log_sessions_on_user_id_and_highlighted", using: :btree
    t.index ["user_id", "started_at"], name: "index_log_sessions_on_user_id_and_started_at", using: :btree
  end

  create_table "log_snapshots", force: :cascade do |t|
    t.integer  "user_id"
    t.datetime "started_at"
    t.text     "settings"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id", "started_at"], name: "index_log_snapshots_on_user_id_and_started_at", using: :btree
  end

  create_table "nfc_tags", force: :cascade do |t|
    t.string   "tag_id"
    t.string   "user_id"
    t.string   "nonce"
    t.boolean  "public"
    t.text     "data"
    t.datetime "created_at",  null: false
    t.datetime "updated_at",  null: false
    t.boolean  "has_content"
    t.index ["tag_id", "has_content", "public", "user_id"], name: "index_nfc_tags_on_tag_id_and_has_content_and_public_and_user_id", using: :btree
    t.index ["tag_id", "public", "user_id"], name: "index_nfc_tags_on_tag_id_and_public_and_user_id", using: :btree
  end

  create_table "old_keys", force: :cascade do |t|
    t.string   "record_id",  limit: 255
    t.string   "type",       limit: 255
    t.string   "key",        limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["type", "key"], name: "index_old_keys_on_type_and_key", using: :btree
  end

  create_table "organization_units", force: :cascade do |t|
    t.integer  "organization_id"
    t.text     "settings"
    t.integer  "position"
    t.datetime "created_at",      null: false
    t.datetime "updated_at",      null: false
    t.integer  "user_goal_id"
    t.index ["organization_id", "position"], name: "index_organization_units_on_organization_id_and_position", using: :btree
  end

  create_table "organization_users", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "organization_id"
    t.string   "user_type"
    t.datetime "created_at",      null: false
    t.datetime "updated_at",      null: false
    t.index ["organization_id", "user_type"], name: "index_organization_users_on_organization_id_and_user_type", using: :btree
  end

  create_table "organizations", force: :cascade do |t|
    t.text     "settings"
    t.boolean  "admin"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "parent_organization_id"
    t.boolean  "custom_domain"
    t.string   "external_auth_key"
    t.string   "external_auth_shortcut"
    t.integer  "user_goal_id"
    t.index ["admin"], name: "index_organizations_on_admin", unique: true, using: :btree
    t.index ["custom_domain"], name: "index_organizations_on_custom_domain", using: :btree
    t.index ["external_auth_key"], name: "index_organizations_on_external_auth_key", unique: true, using: :btree
    t.index ["external_auth_shortcut"], name: "index_organizations_on_external_auth_shortcut", unique: true, using: :btree
    t.index ["parent_organization_id"], name: "index_organizations_on_parent_organization_id", using: :btree
  end

  create_table "profile_templates", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "organization_id"
    t.integer  "parent_id"
    t.datetime "created_at",        null: false
    t.datetime "updated_at",        null: false
    t.text     "settings"
    t.string   "public_profile_id"
    t.boolean  "communicator"
    t.index ["public_profile_id"], name: "index_profile_templates_on_public_profile_id", unique: true, using: :btree
  end

  create_table "progresses", force: :cascade do |t|
    t.text     "settings"
    t.string   "nonce",       limit: 255
    t.datetime "started_at"
    t.datetime "finished_at"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["nonce"], name: "index_progresses_on_nonce", using: :btree
  end

  create_table "purchase_tokens", force: :cascade do |t|
    t.string   "token"
    t.integer  "user_id"
    t.datetime "created_at",       null: false
    t.datetime "updated_at",       null: false
    t.string   "hashed_device_id"
    t.index ["hashed_device_id"], name: "index_purchase_tokens_on_hashed_device_id", using: :btree
    t.index ["token"], name: "index_purchase_tokens_on_token", unique: true, using: :btree
  end

  create_table "remote_actions", force: :cascade do |t|
    t.datetime "act_at"
    t.string   "path"
    t.string   "action"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string   "extra"
  end

  create_table "remote_targets", force: :cascade do |t|
    t.string   "target_type"
    t.string   "source_hash"
    t.string   "target_hash"
    t.string   "salt"
    t.integer  "user_id"
    t.integer  "target_id"
    t.integer  "target_index"
    t.string   "contact_id"
    t.datetime "last_outbound_at"
    t.datetime "created_at",       null: false
    t.datetime "updated_at",       null: false
    t.index ["target_type", "target_id", "target_index"], name: "remote_targets_target_sorting", using: :btree
  end

  create_table "settings", force: :cascade do |t|
    t.string   "key",        limit: 255
    t.string   "value",      limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.text     "data"
    t.index ["key"], name: "index_settings_on_key", unique: true, using: :btree
  end

  create_table "user_badges", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "user_goal_id"
    t.boolean  "superseded"
    t.integer  "level"
    t.text     "data"
    t.boolean  "highlighted"
    t.boolean  "earned"
    t.datetime "created_at",   null: false
    t.datetime "updated_at",   null: false
    t.boolean  "disabled"
    t.index ["disabled"], name: "index_user_badges_on_disabled", using: :btree
  end

  create_table "user_board_connections", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "board_id"
    t.boolean  "home"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "parent_board_id"
    t.string   "locale"
    t.index ["board_id", "home", "updated_at"], name: "user_board_lookups", using: :btree
    t.index ["user_id", "board_id"], name: "index_user_board_connections_on_user_id_and_board_id", using: :btree
  end

  create_table "user_extras", force: :cascade do |t|
    t.integer  "user_id"
    t.text     "settings"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_user_extras_on_user_id", unique: true, using: :btree
  end

  create_table "user_goals", force: :cascade do |t|
    t.integer  "user_id"
    t.boolean  "active"
    t.text     "settings"
    t.boolean  "template"
    t.boolean  "template_header"
    t.datetime "advance_at"
    t.datetime "created_at",      null: false
    t.datetime "updated_at",      null: false
    t.boolean  "primary"
    t.boolean  "global"
    t.index ["advance_at"], name: "index_user_goals_on_advance_at", using: :btree
    t.index ["global"], name: "index_user_goals_on_global", using: :btree
    t.index ["template_header"], name: "index_user_goals_on_template_header", using: :btree
    t.index ["user_id", "active"], name: "index_user_goals_on_user_id_and_active", using: :btree
  end

  create_table "user_integrations", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "device_id"
    t.boolean  "template"
    t.text     "settings"
    t.datetime "created_at",              null: false
    t.datetime "updated_at",              null: false
    t.boolean  "for_button"
    t.string   "integration_key"
    t.integer  "template_integration_id"
    t.string   "unique_key"
    t.index ["integration_key"], name: "index_user_integrations_on_integration_key", unique: true, using: :btree
    t.index ["template"], name: "index_user_integrations_on_template", using: :btree
    t.index ["template_integration_id", "user_id"], name: "index_user_integrations_on_template_integration_id_and_user_id", using: :btree
    t.index ["unique_key"], name: "index_user_integrations_on_unique_key", unique: true, using: :btree
    t.index ["user_id", "created_at"], name: "index_user_integrations_on_user_id_and_created_at", using: :btree
    t.index ["user_id", "for_button"], name: "index_user_integrations_on_user_id_and_for_button", using: :btree
  end

  create_table "user_link_codes", force: :cascade do |t|
    t.integer  "user_id"
    t.string   "user_global_id", limit: 255
    t.string   "code",           limit: 255
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["code"], name: "index_user_link_codes_on_code", unique: true, using: :btree
  end

  create_table "user_links", force: :cascade do |t|
    t.integer  "user_id"
    t.string   "record_code"
    t.text     "data"
    t.datetime "created_at",        null: false
    t.datetime "updated_at",        null: false
    t.integer  "secondary_user_id"
    t.index ["record_code"], name: "index_user_links_on_record_code", using: :btree
    t.index ["secondary_user_id"], name: "index_user_links_on_secondary_user_id", using: :btree
    t.index ["user_id"], name: "index_user_links_on_user_id", using: :btree
  end

  create_table "user_videos", force: :cascade do |t|
    t.integer  "user_id"
    t.string   "url",        limit: 4096
    t.text     "settings"
    t.string   "file_hash"
    t.boolean  "public"
    t.datetime "created_at",              null: false
    t.datetime "updated_at",              null: false
    t.string   "nonce"
  end

  create_table "users", force: :cascade do |t|
    t.string   "user_name",                limit: 255
    t.string   "email_hash",               limit: 4096
    t.text     "settings"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.datetime "expires_at"
    t.integer  "managing_organization_id"
    t.integer  "managed_organization_id"
    t.datetime "next_notification_at"
    t.boolean  "possibly_full_premium"
    t.datetime "badges_updated_at"
    t.datetime "schedule_deletion_at"
    t.datetime "boards_updated_at"
    t.datetime "sync_stamp"
    t.index ["email_hash"], name: "index_users_on_email_hash", using: :btree
    t.index ["managed_organization_id"], name: "index_users_on_managed_organization_id", using: :btree
    t.index ["managing_organization_id"], name: "index_users_on_managing_organization_id", using: :btree
    t.index ["next_notification_at"], name: "index_users_on_next_notification_at", using: :btree
    t.index ["possibly_full_premium"], name: "index_users_on_possibly_full_premium", using: :btree
    t.index ["schedule_deletion_at"], name: "index_users_on_schedule_deletion_at", using: :btree
    t.index ["user_name"], name: "index_users_on_user_name", unique: true, using: :btree
  end

  create_table "utterances", force: :cascade do |t|
    t.text     "data"
    t.integer  "user_id"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.string   "nonce",       limit: 255
    t.string   "reply_nonce"
    t.index ["reply_nonce"], name: "index_utterances_on_reply_nonce", unique: true, using: :btree
  end

  create_table "versions", force: :cascade do |t|
    t.string   "item_type",  limit: 255, null: false
    t.integer  "item_id",                null: false
    t.string   "event",      limit: 255, null: false
    t.string   "whodunnit",  limit: 255
    t.text     "object"
    t.datetime "created_at"
    t.index ["item_type", "item_id"], name: "index_versions_on_item_type_and_item_id", using: :btree
  end

  create_table "webhooks", force: :cascade do |t|
    t.integer  "user_id"
    t.string   "record_code",         limit: 255
    t.text     "settings"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "user_integration_id"
    t.index ["record_code", "user_id"], name: "index_webhooks_on_record_code_and_user_id", using: :btree
    t.index ["user_id"], name: "index_webhooks_on_user_id", using: :btree
  end

  create_table "weekly_stats_summaries", force: :cascade do |t|
    t.integer  "user_id"
    t.integer  "board_id"
    t.integer  "weekyear"
    t.text     "data"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.index ["board_id", "weekyear"], name: "index_weekly_stats_summaries_on_board_id_and_weekyear", using: :btree
    t.index ["user_id", "weekyear"], name: "index_weekly_stats_summaries_on_user_id_and_weekyear", using: :btree
  end

  create_table "word_data", force: :cascade do |t|
    t.string   "word",       limit: 255
    t.string   "locale",     limit: 255
    t.text     "data"
    t.datetime "created_at"
    t.datetime "updated_at"
    t.integer  "priority"
    t.integer  "reviews"
    t.index ["locale", "priority", "word"], name: "index_word_data_on_locale_and_priority_and_word", using: :btree
    t.index ["locale", "reviews", "priority", "word"], name: "index_word_data_on_locale_and_reviews_and_priority_and_word", using: :btree
    t.index ["word", "locale"], name: "index_word_data_on_word_and_locale", unique: true, using: :btree
  end

end
