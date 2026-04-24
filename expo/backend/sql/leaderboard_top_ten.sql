-- =====================================================================
-- Leaderboard — scale migration (designed for 10k+ trips)
--
-- Strategy:
--   * Replace the plain VIEW with a MATERIALIZED VIEW so the expensive
--     SUM/GROUP BY over `public.trips` runs ONCE per refresh instead of
--     on every API request.
--   * Unique index on the mat-view lets us REFRESH ... CONCURRENTLY
--     (non-blocking reads during refresh).
--   * Per-category indexes power the single-row leaderboards
--     (top speed, acceleration, g-force, 0-100, 0-200, 100-200) with
--     index-only range scans instead of heap scans.
--
-- Run this file once in Supabase SQL editor. It is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Supporting indexes for aggregation + per-category leaderboards
-- ---------------------------------------------------------------------

-- Total-distance aggregation (user_id = GROUP BY key, distance = SUM target)
CREATE INDEX IF NOT EXISTS idx_trips_user_id_distance
  ON public.trips USING btree (user_id, distance);

-- Partial index: most rows have distance > 0, but we still want to skip noise
CREATE INDEX IF NOT EXISTS idx_trips_distance_positive
  ON public.trips USING btree (distance DESC)
  WHERE distance > 0;

-- Top-speed leaderboard: "WHERE top_speed BETWEEN 0 AND 400 ORDER BY top_speed DESC LIMIT 10"
CREATE INDEX IF NOT EXISTS idx_trips_top_speed_desc
  ON public.trips USING btree (top_speed DESC)
  WHERE top_speed > 0 AND top_speed <= 400;

-- Acceleration leaderboard
CREATE INDEX IF NOT EXISTS idx_trips_acceleration_desc
  ON public.trips USING btree (acceleration DESC)
  WHERE acceleration > 0;

-- Max G-force leaderboard
CREATE INDEX IF NOT EXISTS idx_trips_max_g_force_desc
  ON public.trips USING btree (max_g_force DESC)
  WHERE max_g_force > 0;

-- 0-100 / 0-200 / 100-200 (ascending — smaller is better)
CREATE INDEX IF NOT EXISTS idx_trips_time_0_to_100
  ON public.trips USING btree (time_0_to_100 ASC)
  WHERE time_0_to_100 IS NOT NULL AND time_0_to_100 > 0;

CREATE INDEX IF NOT EXISTS idx_trips_time_0_to_200
  ON public.trips USING btree (time_0_to_200 ASC)
  WHERE time_0_to_200 IS NOT NULL AND time_0_to_200 > 0;

CREATE INDEX IF NOT EXISTS idx_trips_time_100_to_200
  ON public.trips USING btree (time_100_to_200 ASC)
  WHERE time_100_to_200 IS NOT NULL AND time_100_to_200 > 0;

-- Time-window leaderboards use start_time as a gte filter
CREATE INDEX IF NOT EXISTS idx_trips_start_time_desc
  ON public.trips USING btree (start_time DESC);

-- ---------------------------------------------------------------------
-- 2. Drop the old plain VIEW if it exists, then create MATERIALIZED VIEW
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.leaderboard_top_ten;
DROP MATERIALIZED VIEW IF EXISTS public.leaderboard_top_ten;

CREATE MATERIALIZED VIEW public.leaderboard_top_ten AS
SELECT
  agg.user_id,
  COALESCE(u.display_name, agg.user_name)               AS user_name,
  COALESCE(u.profile_picture, agg.user_profile_picture) AS user_profile_picture,
  u.car_brand                                           AS car_brand,
  u.car_model                                           AS car_model,
  u.country                                             AS country,
  u.city                                                AS city,
  agg.total_distance,
  agg.trip_count,
  agg.last_trip_at
FROM (
  SELECT
    t.user_id,
    MAX(t.user_name)                    AS user_name,
    MAX(t.user_profile_picture)         AS user_profile_picture,
    SUM(t.distance)::double precision   AS total_distance,
    COUNT(*)                            AS trip_count,
    MAX(t.start_time)                   AS last_trip_at
  FROM public.trips t
  WHERE t.distance > 0
  GROUP BY t.user_id
  ORDER BY total_distance DESC
  LIMIT 10
) agg
LEFT JOIN public.users u ON u.id = agg.user_id
ORDER BY agg.total_distance DESC;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_top_ten_user_id
  ON public.leaderboard_top_ten (user_id);

-- Secondary index for the common "ORDER BY total_distance DESC" read path
CREATE INDEX IF NOT EXISTS idx_leaderboard_top_ten_total_distance
  ON public.leaderboard_top_ten (total_distance DESC);

-- ---------------------------------------------------------------------
-- 3. Refresh helper — callable via PostgREST RPC from the backend
--    SECURITY DEFINER so the anon/service role can trigger the refresh
--    without owning the view.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_leaderboard_top_ten()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CONCURRENTLY so reads are never blocked. Falls back to a plain
  -- refresh the first time (mat-view must be populated at least once
  -- for CONCURRENTLY to be allowed).
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.leaderboard_top_ten;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW public.leaderboard_top_ten;
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------
GRANT SELECT ON public.leaderboard_top_ten TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_top_ten() TO anon, authenticated, service_role;

-- Populate once so the first read is instant
REFRESH MATERIALIZED VIEW public.leaderboard_top_ten;
