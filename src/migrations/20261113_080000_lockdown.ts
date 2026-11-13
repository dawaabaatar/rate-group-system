import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Өгөгдлийн сангийн түвшний хамгаалалт (аппликейшний шалгалтаас хамааралгүй):
 *  - оноо 1..5, өөрийгөө үнэлэхгүй
 *  - бүх хүснэгтэд RLS (policy-гүй = Supabase-ийн anon/authenticated юу ч харахгүй)
 *  - anon/authenticated ролиос эрх хураах (Supabase дээр л байдаг ролиуд)
 * Payload `postgres` (owner) эрхээр холбогддог тул RLS-д нөлөөлөхгүй.
 * ШИНЭ хүснэгт нэмсэн migration бүрийн дараа энэ блокийг дахин ажиллуулах migration нэмнэ.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "rating"."ratings" ADD CONSTRAINT "ratings_score_range" CHECK ("score" >= 1 AND "score" <= 5 AND "score" = trunc("score"));
    ALTER TABLE "rating"."ratings" ADD CONSTRAINT "ratings_no_self_rating" CHECK ("rater_id" <> "ratee_id");

    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'rating' LOOP
        EXECUTE format('ALTER TABLE rating.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      END LOOP;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON SCHEMA rating FROM anon;
        REVOKE ALL ON ALL TABLES IN SCHEMA rating FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA rating FROM anon;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON SCHEMA rating FROM authenticated;
        REVOKE ALL ON ALL TABLES IN SCHEMA rating FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA rating FROM authenticated;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "rating"."ratings" DROP CONSTRAINT IF EXISTS "ratings_score_range";
    ALTER TABLE "rating"."ratings" DROP CONSTRAINT IF EXISTS "ratings_no_self_rating";
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'rating' LOOP
        EXECUTE format('ALTER TABLE rating.%I DISABLE ROW LEVEL SECURITY', t.tablename);
      END LOOP;
    END $$;
  `)
}
