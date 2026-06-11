-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Body" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxShutterSpeed" TEXT,
    CONSTRAINT "Body_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxAperture" TEXT,
    "minAperture" TEXT,
    CONSTRAINT "Lens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Roll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxFrames" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Roll_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
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

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
