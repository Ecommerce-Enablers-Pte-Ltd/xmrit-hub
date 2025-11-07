ALTER TABLE "metric" ADD COLUMN "ranking" integer;--> statement-breakpoint
CREATE INDEX "metric_ranking_idx" ON "metric" USING btree ("ranking");