-- =====================================================================
-- Leaderboard Top Ten — optimization migration
-- Run this in Supabase SQL editor (or via migrations).
--
-- Notes:
--   * This project's table is `public.trips` (not "drives") and the user
--     info lives in `public.users` (not "profiles").
--   * The view aggregates SUM(distance) per user and joins the user row
--     to get display_name / profile_picture / car info for the UI.
-- =====================================================================

-- 1. B-tree composite index to speed up the per-user distance aggregation.
--    Order matters: user_id first (GROUP BY), distance second (SUM / filter).
CREATE INDEX IF NOT EXISTS idx_trips_user_id_distance
  ON public.trips USING btree (user_id, distance);

-- Helpful supporting index for the WHERE distance > 0 predicate.
CREATE INDEX IF NOT EXISTS idx_trips_distance_positive
  ON public.trips USING btree (distance)
  WHERE distance > 0;

-- 2. View: top 10 drivers by total distance, joined with user profile data.
CREATE OR REPLACE VIEW public.leaderboard_top_ten AS
SELECT
  agg.user_id,
  COALESCE(u.display_name, agg.user_name)             AS user_name,
  COALESCE(u.profile_picture, agg.user_profile_picture) AS user_profile_picture,
  u.car_brand                                          AS car_brand,
  u.car_model                                          AS car_model,
  u.country                                            AS country,
  u.city                                               AS city,
  agg.total_distance,
  agg.trip_count,
  agg.last_trip_at
FROM (
  SELECT
    t.user_id,
    MAX(t.user_name)            AS user_name,
    MAX(t.user_profile_picture) AS user_profile_picture,
    SUM(t.distance)::double precision AS total_distance,
    COUNT(*)                    AS trip_count,
    MAX(t.start_time)           AS last_trip_at
  FROM public.trips t
  WHERE t.distance > 0
  GROUP BY t.user_id
  ORDER BY total_distance DESC
  LIMIT 10
) agg
LEFT JOIN public.users u ON u.id = agg.user_id
ORDER BY agg.total_distance DESC;

-- 3. Allow the anon / service_role clients to read the view via PostgREST.
GRANT SELECT ON public.leaderboard_top_ten TO anon, authenticated, service_role;
