-- AlterTable
ALTER TABLE "Body" ADD COLUMN "maxShutterSpeed" TEXT;

-- AlterTable
ALTER TABLE "Lens" ADD COLUMN "maxAperture" TEXT;
ALTER TABLE "Lens" ADD COLUMN "minAperture" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "isDigital" BOOLEAN NOT NULL DEFAULT false,
    "rollId" TEXT,
    "bodyId" TEXT,
    "lensId" TEXT,
    "cutIndex" INTEGER,
    "aperture" TEXT,
    "shutterSpeed" TEXT,
    "iso" TEXT,
    "notes" TEXT,
    "imageUrl" TEXT,
    "originalUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Photo_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "Roll" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_bodyId_fkey" FOREIGN KEY ("bodyId") REFERENCES "Body" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_lensId_fkey" FOREIGN KEY ("lensId") REFERENCES "Lens" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("aperture", "bodyId", "cutIndex", "id", "imageUrl", "isDigital", "isPublished", "lensId", "notes", "rollId", "shutterSpeed", "userId") SELECT "aperture", "bodyId", "cutIndex", "id", "imageUrl", "isDigital", "isPublished", "lensId", "notes", "rollId", "shutterSpeed", "userId" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
