/*
  Warnings:

  - Added the required column `position` to the `SeatAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SeatAssignment" ADD COLUMN     "position" INTEGER NOT NULL;
