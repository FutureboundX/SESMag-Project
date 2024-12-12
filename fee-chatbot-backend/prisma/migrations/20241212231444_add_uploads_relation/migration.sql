/*
  Warnings:

  - Added the required column `conversationId` to the `Upload` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "conversationId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
