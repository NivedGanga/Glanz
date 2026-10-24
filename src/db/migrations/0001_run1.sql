CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE district (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, country_code text NOT NULL,
  timezone text NOT NULL, currency text NOT NULL, launch_state text NOT NULL DEFAULT 'demo',
  center_lat double precision, center_lng double precision, radius_km double precision,
  is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE plan (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, is_fake boolean NOT NULL DEFAULT false);
CREATE TABLE shop (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legal_name text NOT NULL, email text NOT NULL UNIQUE,
  district_id uuid NOT NULL REFERENCES district(id), listing_status text NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft','published','paused')),
  verified_at timestamptz, phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{1,14}$'),
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb, plan_id uuid NOT NULL REFERENCES plan(id),
  buffer_override_days integer CHECK (buffer_override_days >= 0),
  catalog_token_hash text UNIQUE, is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE branch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES shop(id),
  address text NOT NULL, lat double precision, lng double precision, is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE shop_user (
  user_id uuid NOT NULL, shop_id uuid NOT NULL REFERENCES shop(id), email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','staff')),
  PRIMARY KEY (user_id, shop_id)
);
CREATE TABLE shop_settings (
  shop_id uuid PRIMARY KEY REFERENCES shop(id), notification_daily_cap integer NOT NULL,
  quiet_hours jsonb NOT NULL DEFAULT '{"start":"21:00","end":"09:00"}'::jsonb,
  muted_categories uuid[] NOT NULL DEFAULT '{}', digest_interval_hours integer NOT NULL DEFAULT 12
);
CREATE TABLE customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone text NOT NULL UNIQUE
    CHECK (phone ~ '^\+[1-9][0-9]{1,14}$'),
  name text NOT NULL, district_id uuid NOT NULL REFERENCES district(id), is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_type text NOT NULL, subject_id uuid NOT NULL,
  purpose text NOT NULL, version text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
CREATE TABLE category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
  attribute_schema jsonb NOT NULL DEFAULT '{}'::jsonb, default_buffer_days integer NOT NULL DEFAULT 0,
  is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE design (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL REFERENCES shop(id),
  category_id uuid NOT NULL REFERENCES category(id), name text NOT NULL, description text NOT NULL DEFAULT '',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','paused')),
  is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE unit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), design_id uuid NOT NULL REFERENCES design(id),
  branch_id uuid NOT NULL REFERENCES branch(id), condition text NOT NULL, is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE rate_card (
  design_id uuid NOT NULL REFERENCES design(id), period_type text NOT NULL
    CHECK (period_type IN ('day','weekend','week','custom')),
  price_paise integer NOT NULL CHECK (price_paise >= 0), currency text NOT NULL,
  PRIMARY KEY (design_id, period_type)
);
CREATE TABLE availability_block (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), unit_id uuid NOT NULL REFERENCES unit(id),
  time_range tstzrange NOT NULL, kind text NOT NULL
    CHECK (kind IN ('rental','buffer','maintenance','alteration')),
  source_id uuid, created_by uuid NOT NULL, CHECK (NOT isempty(time_range)),
  EXCLUDE USING gist (unit_id WITH =, time_range WITH &&)
);
CREATE TABLE photo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_type text NOT NULL CHECK (owner_type IN ('design','request')),
  owner_id uuid NOT NULL, storage_key text NOT NULL, is_synthetic boolean NOT NULL,
  status text NOT NULL DEFAULT 'active', replaced_at timestamptz, is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE photo_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), photo_id uuid NOT NULL REFERENCES photo(id),
  purpose text NOT NULL CHECK (purpose IN ('shop_listing','customer_request')),
  consent_id uuid REFERENCES consent(id), provider text NOT NULL, model_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','done','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0, error_code text, created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, UNIQUE (photo_id)
);
CREATE TABLE tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL CHECK (entity_type IN ('design','request')),
  entity_id uuid NOT NULL, field text NOT NULL
    CHECK (field IN ('category','gender_fit','colour','era_style','occasion','keyword','size_range')),
  value text NOT NULL, source text NOT NULL CHECK (source IN ('ai','shop','admin')),
  status text NOT NULL CHECK (status IN ('suggested','confirmed','rejected')),
  model_version text, confirmed_by uuid, confirmed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE synonym (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), field text NOT NULL, category_id uuid REFERENCES category(id),
  term text NOT NULL, canonical_value text NOT NULL, created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'draft',
  is_fake boolean NOT NULL DEFAULT false
);
CREATE TABLE request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customer(id),
  district_id uuid NOT NULL REFERENCES district(id), event_start timestamptz NOT NULL,
  return_end timestamptz NOT NULL, description text NOT NULL, group_size integer NOT NULL CHECK (group_size > 0),
  category_id uuid REFERENCES category(id), answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_distance_km double precision, status text NOT NULL DEFAULT 'draft',
  is_fake boolean NOT NULL DEFAULT false, CHECK (event_start < return_end)
);
CREATE TABLE request_photo (
  request_id uuid NOT NULL REFERENCES request(id), photo_id uuid NOT NULL REFERENCES photo(id),
  PRIMARY KEY (request_id, photo_id)
);
CREATE TABLE request_answer (
  request_id uuid NOT NULL REFERENCES request(id), question text NOT NULL, answer text NOT NULL,
  PRIMARY KEY (request_id, question)
);
CREATE TABLE request_shop (
  request_id uuid NOT NULL REFERENCES request(id), shop_id uuid NOT NULL REFERENCES shop(id),
  status text NOT NULL DEFAULT 'sent', decline_reason text, responded_at timestamptz,
  PRIMARY KEY (request_id, shop_id)
);
CREATE TABLE recommendation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES request(id),
  shop_id uuid NOT NULL REFERENCES shop(id), design_id uuid NOT NULL REFERENCES design(id),
  raw_score double precision, rank integer, reasons jsonb NOT NULL DEFAULT '[]',
  exclusion_reasons jsonb NOT NULL DEFAULT '[]', shown_at timestamptz,
  flag_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient text NOT NULL, shop_id uuid REFERENCES shop(id),
  channel text NOT NULL, template text NOT NULL, status text NOT NULL,
  sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), error_code text
);
CREATE TABLE report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), target_type text NOT NULL, target_id uuid NOT NULL,
  reason text NOT NULL, status text NOT NULL DEFAULT 'open',
  reviewer_history jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, type text NOT NULL,
  subject text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
  flag_snapshot jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION forbid_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'events are append-only'; END $$;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON event
  FOR EACH ROW EXECUTE FUNCTION forbid_event_mutation();
CREATE TABLE flag (
  key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, owner text NOT NULL,
  description text NOT NULL, removal_target date NOT NULL
);
CREATE TABLE flag_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flag_key text NOT NULL REFERENCES flag(key),
  cohort text NOT NULL, cohort_id text NOT NULL, enabled boolean NOT NULL
);
CREATE TABLE flag_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flag_key text NOT NULL REFERENCES flag(key),
  actor text NOT NULL, enabled boolean NOT NULL, changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_challenge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identity text NOT NULL, kind text NOT NULL,
  secret_hash text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz,
  requested_ip text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_session (
  token_hash text PRIMARY KEY, subject_type text NOT NULL, subject_id uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX design_name_trgm ON design USING gin (name gin_trgm_ops);
CREATE INDEX design_description_trgm ON design USING gin (description gin_trgm_ops);
CREATE INDEX tag_keyword_trgm ON tag USING gin (value gin_trgm_ops) WHERE field = 'keyword' AND status = 'confirmed';
CREATE INDEX auth_identity_recent ON auth_challenge(identity, created_at DESC);
CREATE INDEX auth_ip_recent ON auth_challenge(requested_ip, created_at DESC);
CREATE INDEX notification_daily ON notification(shop_id, sent_at DESC);
CREATE INDEX recommendation_request ON recommendation(request_id);
