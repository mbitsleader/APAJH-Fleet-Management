/*
  Warnings:

  - The values [USER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('PERMANENT', 'REPLACEMENT');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DIRECTEUR', 'MANAGER', 'PROFESSIONNEL');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PROFESSIONNEL';
COMMIT;

-- AlterTable
ALTER TABLE "FuelLog" ALTER COLUMN "liters" DROP NOT NULL,
ALTER COLUMN "cost" DROP NOT NULL,
ALTER COLUMN "mileageAtFill" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "role" SET DEFAULT 'PROFESSIONNEL';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "lowFuel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceId" TEXT,
ADD COLUMN     "type" "VehicleType" NOT NULL DEFAULT 'PERMANENT';

-- CreateTable
CREATE TABLE "Pole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poleId" TEXT,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPole" (
    "userId" TEXT NOT NULL,
    "poleId" TEXT NOT NULL,

    CONSTRAINT "UserPole_pkey" PRIMARY KEY ("userId","poleId")
);

-- CreateTable
CREATE TABLE "UserService" (
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "UserService_pkey" PRIMARY KEY ("userId","serviceId")
);

-- CreateTable
CREATE TABLE "CleaningSchedule" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningAssignment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleaningAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationPassenger" (
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ReservationPassenger_pkey" PRIMARY KEY ("reservationId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pole_name_key" ON "Pole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "CleaningSchedule_vehicleId_idx" ON "CleaningSchedule"("vehicleId");

-- CreateIndex
CREATE INDEX "CleaningSchedule_weekStart_idx" ON "CleaningSchedule"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningSchedule_vehicleId_weekStart_key" ON "CleaningSchedule"("vehicleId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "CleaningAssignment_scheduleId_userId_key" ON "CleaningAssignment"("scheduleId", "userId");

-- CreateIndex
CREATE INDEX "ReservationPassenger_userId_idx" ON "ReservationPassenger"("userId");

-- CreateIndex
CREATE INDEX "FuelLog_vehicleId_idx" ON "FuelLog"("vehicleId");

-- CreateIndex
CREATE INDEX "FuelLog_userId_idx" ON "FuelLog"("userId");

-- CreateIndex
CREATE INDEX "Incident_vehicleId_idx" ON "Incident"("vehicleId");

-- CreateIndex
CREATE INDEX "Incident_userId_idx" ON "Incident"("userId");

-- CreateIndex
CREATE INDEX "Reservation_vehicleId_startTime_endTime_idx" ON "Reservation"("vehicleId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Reservation_vehicleId_idx" ON "Reservation"("vehicleId");

-- CreateIndex
CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");

-- CreateIndex
CREATE INDEX "Reservation_startTime_idx" ON "Reservation"("startTime");

-- CreateIndex
CREATE INDEX "Reservation_endTime_idx" ON "Reservation"("endTime");

-- CreateIndex
CREATE INDEX "TripLog_vehicleId_idx" ON "TripLog"("vehicleId");

-- CreateIndex
CREATE INDEX "TripLog_userId_idx" ON "TripLog"("userId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPole" ADD CONSTRAINT "UserPole_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES "Pole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPole" ADD CONSTRAINT "UserPole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserService" ADD CONSTRAINT "UserService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserService" ADD CONSTRAINT "UserService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningSchedule" ADD CONSTRAINT "CleaningSchedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningAssignment" ADD CONSTRAINT "CleaningAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CleaningSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningAssignment" ADD CONSTRAINT "CleaningAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPassenger" ADD CONSTRAINT "ReservationPassenger_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationPassenger" ADD CONSTRAINT "ReservationPassenger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
