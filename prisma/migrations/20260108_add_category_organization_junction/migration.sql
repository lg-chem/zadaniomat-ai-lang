-- CreateTable
CREATE TABLE "CategoryOrganization" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "CategoryOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryOrganization_categoryId_idx" ON "CategoryOrganization"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryOrganization_organizationId_idx" ON "CategoryOrganization"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryOrganization_categoryId_organizationId_key" ON "CategoryOrganization"("categoryId", "organizationId");

-- AddForeignKey
ALTER TABLE "CategoryOrganization" ADD CONSTRAINT "CategoryOrganization_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOrganization" ADD CONSTRAINT "CategoryOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data: copy organizationId from Category to CategoryOrganization
INSERT INTO "CategoryOrganization" ("id", "categoryId", "organizationId", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "organizationId",
    CURRENT_TIMESTAMP
FROM "Category"
WHERE "organizationId" IS NOT NULL;
