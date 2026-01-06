import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

const BUILT_IN_GAME_SYSTEMS = [
  {
    name: "D&D 5e",
    description: "Dungeons & Dragons Fifth Edition",
    defaultInstructions: `Before the session:
- Review your character sheet and recent events
- Prepare any spell slots or abilities
- Have your dice ready (d4, d6, d8, d10, d12, d20)
- Check the party's current quest objectives`,
    isBuiltIn: true,
  },
  {
    name: "Pathfinder 2e",
    description: "Pathfinder Second Edition by Paizo",
    defaultInstructions: `Before the session:
- Review your character build and action options
- Prepare exploration activities
- Check your inventory and consumables
- Review the three-action economy`,
    isBuiltIn: true,
  },
  {
    name: "Call of Cthulhu",
    description: "Horror investigation RPG by Chaosium",
    defaultInstructions: `Before the session:
- Review your investigator's skills and background
- Check sanity and health levels
- Review clues gathered so far
- Prepare for investigation and horror elements`,
    isBuiltIn: true,
  },
  {
    name: "Vampire: The Masquerade",
    description: "World of Darkness vampire RPG",
    defaultInstructions: `Before the session:
- Review your disciplines and abilities
- Check blood pool and humanity
- Consider your character's personal goals
- Review sect and clan politics`,
    isBuiltIn: true,
  },
  {
    name: "Shadowrun",
    description: "Cyberpunk fantasy RPG",
    defaultInstructions: `Before the session:
- Review your character's skills and cyberware
- Check your contacts and resources
- Prepare matrix/magic abilities as applicable
- Review current run objectives`,
    isBuiltIn: true,
  },
  {
    name: "Blades in the Dark",
    description: "Heist-focused RPG",
    defaultInstructions: `Before the session:
- Review your playbook abilities
- Check crew upgrades and claims
- Consider potential scores
- Review faction relationships`,
    isBuiltIn: true,
  },
  {
    name: "FATE Core",
    description: "Narrative-focused RPG system",
    defaultInstructions: `Before the session:
- Review your aspects and stunts
- Consider potential compels
- Check your fate point pool
- Think about your character's current goals`,
    isBuiltIn: true,
  },
  {
    name: "Dungeon World",
    description: "Powered by the Apocalypse fantasy RPG",
    defaultInstructions: `Before the session:
- Review your playbook moves
- Check your bonds with other characters
- Bring 2d6
- Think about what your character wants`,
    isBuiltIn: true,
  },
  {
    name: "Savage Worlds",
    description: "Fast, Furious, Fun! Multi-genre RPG",
    defaultInstructions: `Before the session:
- Review your edges and hindrances
- Check bennies and wounds
- Prepare wild die strategies
- Review setting-specific rules`,
    isBuiltIn: true,
  },
  {
    name: "Other",
    description: "Custom or unlisted game system",
    defaultInstructions: `Before the session:
- Review your character sheet
- Check any house rules with the GM
- Prepare any materials needed
- Review recent session notes`,
    isBuiltIn: true,
  },
];

async function main() {
  console.log("Seeding built-in game systems...");

  for (const system of BUILT_IN_GAME_SYSTEMS) {
    await prisma.gameSystem.upsert({
      where: { name: system.name },
      update: {
        description: system.description,
        defaultInstructions: system.defaultInstructions,
        isBuiltIn: system.isBuiltIn,
      },
      create: system,
    });
    console.log(`  - ${system.name}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
