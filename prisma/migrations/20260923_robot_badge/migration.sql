-- Short marketing label shown on the catalog card and the robot page,
-- e.g. "Prop firm compatible". NULL means no badge.
ALTER TABLE "Robot" ADD COLUMN "badge" TEXT;
