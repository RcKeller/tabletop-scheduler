import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

const BUILT_IN_GAME_SYSTEMS = [
  {
    name: "D&D 5e",
    description: "Dungeons & Dragons Fifth Edition by Wizards of the Coast",
    defaultInstructions: `Before the session:
- Review your character sheet and recent session events
- Prepare spell slots, class features, and ability uses
- Have your dice ready (full polyhedral set)
- Review party objectives and any unresolved storylines
- Check your inventory and spell components

Resources:
- Basic Rules: https://www.dndbeyond.com/sources/basic-rules
- D&D Beyond: https://www.dndbeyond.com
- Player's Handbook: Available at your local game store`,
    isBuiltIn: true,
  },
  {
    name: "Pathfinder 2e",
    description: "Pathfinder Second Edition by Paizo",
    defaultInstructions: `Before the session:
- Review your character build, feats, and action options
- Prepare exploration activities and tactics
- Check your inventory, consumables, and focus points
- Understand the three-action economy
- Review any conditions or effects on your character

Resources:
- Archives of Nethys (free rules): https://2e.aonprd.com
- Pathfinder Nexus: https://app.demiplane.com/nexus/pathfinder2e
- Core Rulebook: https://paizo.com/products/btq01zp3`,
    isBuiltIn: true,
  },
  {
    name: "Call of Cthulhu",
    description: "Horror investigation RPG by Chaosium",
    defaultInstructions: `Before the session:
- Review your investigator's skills, background, and occupation
- Check current sanity, luck, and health levels
- Review clues, handouts, and notes from previous sessions
- Prepare for investigation, roleplay, and possible horror
- Consider your investigator's motivations and fears

Resources:
- Chaosium: https://www.chaosium.com/call-of-cthulhu-rpg
- Quick-Start Rules: https://www.chaosium.com/cthulhu-quickstart
- Keeper's Rulebook: Available from Chaosium`,
    isBuiltIn: true,
  },
  {
    name: "Vampire: The Masquerade",
    description: "World of Darkness vampire RPG by Renegade Game Studios",
    defaultInstructions: `Before the session:
- Review your disciplines, abilities, and predator type
- Check blood pool (hunger dice) and humanity
- Consider your character's personal ambitions and touchstones
- Review sect politics and your coterie's relationships
- Think about your character's beast and how they manage it

Resources:
- World of Darkness: https://www.worldofdarkness.com
- V5 Core Book: https://renegadegamestudios.com/vampire-the-masquerade
- Storyteller's Vault: https://www.storytellersvault.com`,
    isBuiltIn: true,
  },
  {
    name: "Shadowrun 6e",
    description: "Cyberpunk fantasy RPG by Catalyst Game Labs",
    defaultInstructions: `Before the session:
- Review your character's skills, attributes, and qualities
- Check cyberware/bioware, spells, or technomancer abilities
- Review contacts, lifestyle, and nuyen balance
- Prepare your Edge pool strategy
- Review current run objectives and team roles

Resources:
- Catalyst Game Labs: https://www.catalystgamelabs.com/shadowrun
- Shadowrun Sixth World: https://www.shadowrunsixthworld.com
- Core Rulebook: Available from Catalyst`,
    isBuiltIn: true,
  },
  {
    name: "Shadowrun Anarchy",
    description: "Narrative-focused Shadowrun by Catalyst Game Labs",
    defaultInstructions: `Before the session:
- Review your character's skills, shadow amps, and cues
- Check your plot points and karma
- Review the contract brief and team composition
- Prepare narrations for your character's actions
- Think about how your cues might come into play

Resources:
- Catalyst Game Labs: https://www.catalystgamelabs.com/shadowrun
- Anarchy uses narrative rules - focus on story over crunch`,
    isBuiltIn: true,
  },
  {
    name: "Blades in the Dark",
    description: "Heist-focused RPG by Evil Hat Productions",
    defaultInstructions: `Before the session:
- Review your playbook abilities and XP triggers
- Check crew upgrades, claims, and heat level
- Consider potential scores and faction entanglements
- Review your character's vice and trauma
- Think about your crew's reputation and turf

Resources:
- Evil Hat: https://evilhat.com/product/blades-in-the-dark
- Free SRD: https://bladesinthedark.com/basics
- Online Play Resources: https://bladesinthedark.com`,
    isBuiltIn: true,
  },
  {
    name: "FATE Core",
    description: "Narrative-focused RPG system by Evil Hat Productions",
    defaultInstructions: `Before the session:
- Review your aspects (high concept, trouble, and others)
- Check your stunts and refresh rate
- Consider how your aspects might be compelled
- Think about your character's current personal goals
- Review fate point economy and invoke strategies

Resources:
- Evil Hat: https://evilhat.com/product/fate-core-system
- Free SRD: https://fate-srd.com
- Fate Condensed: https://evilhat.com/product/fate-condensed`,
    isBuiltIn: true,
  },
  {
    name: "Dungeon World",
    description: "Powered by the Apocalypse fantasy RPG",
    defaultInstructions: `Before the session:
- Review your playbook moves and advanced moves
- Check your bonds with other characters
- Bring 2d6 (that's all you need!)
- Think about what your character wants right now
- Review any fronts or dangers the GM has introduced

Resources:
- Dungeon World SRD: https://www.dungeonworldsrd.com
- Official Site: https://dungeon-world.com
- Book available from Sage Kobold Productions`,
    isBuiltIn: true,
  },
  {
    name: "Savage Worlds",
    description: "Fast, Furious, Fun! Multi-genre RPG by Pinnacle Entertainment",
    defaultInstructions: `Before the session:
- Review your edges, hindrances, and skills
- Check bennies, wounds, and fatigue
- Understand your wild die and how to use it
- Review any setting-specific rules (fantasy, sci-fi, etc.)
- Check your gear and any special abilities

Resources:
- Pinnacle Entertainment: https://peginc.com/savage-settings/savage-worlds
- Test Drive Rules: https://peginc.com/store/savage-worlds-test-drive-swade
- Adventure Edition Core Rules available from Pinnacle`,
    isBuiltIn: true,
  },
  {
    name: "Masks: A New Generation",
    description: "Superhero drama RPG by Magpie Games",
    defaultInstructions: `Before the session:
- Review your playbook, labels, and moves
- Check your conditions and how they affect you
- Think about your relationships with teammates and adults
- Consider your character's current emotional state
- Review influence - who has it over you and vice versa

Resources:
- Magpie Games: https://magpiegames.com/collections/masks
- Masks uses Powered by the Apocalypse rules
- Focus on the drama of being a young superhero`,
    isBuiltIn: true,
  },
  {
    name: "Fallout: The Roleplaying Game",
    description: "Post-apocalyptic RPG using 2d20 system by Modiphius",
    defaultInstructions: `Before the session:
- Review your S.P.E.C.I.A.L. attributes and skills
- Check your perks, AP, and luck points
- Review your inventory, caps, and equipment condition
- Understand the 2d20 system and momentum/threat
- Think about your character's faction allegiances

Resources:
- Modiphius: https://modiphius.us/collections/fallout-the-roleplaying-game
- Core Rulebook and starter set available from Modiphius
- War never changes. But your wasteland story will.`,
    isBuiltIn: true,
  },
  {
    name: "Alien RPG",
    description: "Sci-fi horror RPG by Free League Publishing",
    defaultInstructions: `Before the session:
- Review your character's skills, talents, and career
- Check your stress level and understand panic mechanics
- Review your gear, consumables, and air supply
- Understand the difference between Cinematic and Campaign play
- Prepare for tension, horror, and difficult choices

Resources:
- Free League: https://freeleaguepublishing.com/games/alien
- Core Rulebook and Starter Set available from Free League
- In space, no one can hear you scream.`,
    isBuiltIn: true,
  },
  {
    name: "Battlestar Galactica",
    description: "Sci-fi survival board game by Fantasy Flight Games",
    defaultInstructions: `Before the session:
- Review your character's abilities and weaknesses
- Understand the loyalty card mechanics (are you a Cylon?)
- Review the current game state and crisis deck threats
- Prepare for paranoia, accusations, and tough decisions
- Know when the sleeper agent phase occurs

Resources:
- BGG Page: https://boardgamegeek.com/boardgame/37111/battlestar-galactica-the-board-game
- This is a board game, not a traditional TTRPG
- Trust no one. Humanity's survival is at stake.`,
    isBuiltIn: true,
  },
  {
    name: "Other",
    description: "Custom or unlisted game system",
    defaultInstructions: `Before the session:
- Review your character sheet and abilities
- Check any house rules with the GM
- Prepare dice and materials needed for the system
- Review notes from previous sessions
- Ask the GM about any rules you're unsure of`,
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
