-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- CreateTable
CREATE TABLE IF NOT EXISTS "custom_emojis" (
    "id" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_emojis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "drafts" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bans" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "text" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "custom_emojis_shortcode_conversationId_key" ON "custom_emojis"("shortcode", "conversationId");
CREATE INDEX IF NOT EXISTS "custom_emojis_conversationId_idx" ON "custom_emojis"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bans_conversationId_userId_key" ON "bans"("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "bans_conversationId_idx" ON "bans"("conversationId");
CREATE INDEX IF NOT EXISTS "bans_userId_idx" ON "bans"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_status_dueAt_idx" ON "reminders"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "reminders_userId_idx" ON "reminders"("userId");

-- AddForeignKey
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_emojis" ADD CONSTRAINT "custom_emojis_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bans" ADD CONSTRAINT "bans_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bans" ADD CONSTRAINT "bans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bans" ADD CONSTRAINT "bans_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
