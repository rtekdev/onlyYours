// Demo data seed. Attaches content to an existing account (users are created
// through Google sign-in, so run this AFTER your first login):
//
//   SEED_USER_EMAIL=you@example.com pnpm db:seed
//
// Deliberately contains no vault items and no secrets — the vault only makes
// sense with client-side encryption, which a seed script cannot (and should
// not) fake.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.SEED_USER_EMAIL;
  if (!email) {
    console.log("Set SEED_USER_EMAIL to the e-mail of an existing account, e.g.:");
    console.log("  SEED_USER_EMAIL=you@example.com pnpm db:seed");
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`No user with e-mail ${email} — sign in through the app first, then re-run the seed.`);
    return;
  }

  const tag = await prisma.noteTag.upsert({
    where: { userId_name: { userId: user.id, name: "demo" } },
    create: { userId: user.id, name: "demo" },
    update: {},
  });

  await prisma.note.createMany({
    data: [
      {
        userId: user.id,
        title: "Witaj w Only Yours 👋",
        content:
          "To jest przykładowa notatka.\n\n- Notatki wspierają Markdown\n- Tagi ułatwiają filtrowanie\n- Kosz chroni przed przypadkowym usunięciem",
      },
      {
        userId: user.id,
        title: "Pomysły do ogarnięcia",
        content: "1. Skonfigurować MFA\n2. Utworzyć vault\n3. Dodać pierwszą automatyzację",
      },
    ],
  });
  // Tag the first demo note.
  const note = await prisma.note.findFirst({ where: { userId: user.id, title: "Witaj w Only Yours 👋" } });
  if (note) {
    await prisma.note.update({ where: { id: note.id }, data: { tags: { connect: { id: tag.id } } } });
  }

  await prisma.scenario.create({
    data: {
      userId: user.id,
      title: "Onboarding Only Yours",
      description: "Pierwsze kroki po instalacji.",
      status: "ACTIVE",
      steps: {
        create: [
          { title: "Zaloguj się przez Google", position: 1, completedAt: new Date() },
          { title: "Włącz MFA w ustawieniach bezpieczeństwa", position: 2 },
          { title: "Utwórz vault i dodaj pierwszy sekret", position: 3 },
          { title: "Przetestuj automatyzację 'Codzienny dziennik'", position: 4 },
        ],
      },
    },
  });

  await prisma.automation.create({
    data: {
      userId: user.id,
      name: "Codzienny dziennik",
      description: "Tworzy notatkę-dziennik z dzisiejszą datą.",
      triggerType: "MANUAL",
      actionType: "CREATE_NOTE",
      config: {
        titleTemplate: "Dziennik {{date}}",
        contentTemplate: "## {{datetime}}\n\n- \n",
        tags: ["dziennik"],
      },
    },
  });

  console.log(`Seeded demo data for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
