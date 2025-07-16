const {
    AttachmentBuilder,
    ApplicationCommandOptionType,
} = require("discord.js");

const { Client } = require("nekos-best.js");
const nekosBest = new Client();

// Creative expressive messages, with placeholders for user and target
const messages = {
    angry: {
        self: "{user} is angry! Rahh!",
        target: "{user} is angry at {target}! GRRR!",
    },
    baka: {
        self: "{user} is being a total baka! 😤",
        target: "{user} calls {target} a baka! Watch out! 😤",
    },
    blush: {
        self: "{user} is blushing... so cute! 😊",
        target: "{user} made {target} blush! Aww! 😊",
    },
    bored: {
        self: "{user} is bored... yawn...",
        target: "{user} is bored with {target}... zzz",
    },
    cry: {
        self: "{user} is crying... 😢 Stay strong!",
        target: "{user} is crying because of {target}... 😢",
    },
    dance: {
        self: "{user} is dancing like nobody's watching! 💃",
        target: "{user} is dancing with {target}! Let's party! 💃",
    },
    facepalm: {
        self: "{user} facepalms... why? 🤦",
        target: "{user} facepalms at {target}'s antics! 🤦",
    },
    happy: {
        self: "{user} is feeling so happy! 😄",
        target: "{user} made {target} happy! 😊",
    },
    laugh: {
        self: "{user} is laughing out loud! 😂",
        target: "{user} is laughing at {target}! Haha!",
    },
    lurk: {
        self: "{user} is just lurking... 👀",
        target: "{user} is lurking around {target}... 👀",
    },
    nod: {
        self: "{user} nods in agreement.",
        target: "{user} nods at {target}.",
    },
    nom: {
        self: "{user} is nom nom nomming! 🍽️",
        target: "{user} offers some noms to {target}.",
    },
    nope: {
        self: "{user} says nope! 🙅",
        target: "{user} says nope to {target}! 🙅",
    },
    pout: {
        self: "{user} is pouting like a tsundere! 😒",
        target: "{user} pouts at {target}.",
    },
    run: {
        self: "{user} runs away! 🏃",
        target: "{user} runs away from {target}! 🏃",
    },
    shrug: {
        self: "{user} shrugs it off. 🤷",
        target: "{user} shrugs at {target}. 🤷",
    },
    sleep: {
        self: "{user} is sleeping... zzz 😴",
        target: "{user} is sleeping next to {target}.",
    },
    smile: {
        self: "{user} smiles sweetly. 😊",
        target: "{user} smiles at {target}. 😊",
    },
    smug: {
        self: "{user} looks so smug... 😏",
        target: "{user} looks smug at {target}. 😏",
    },
    stare: {
        self: "{user} is staring intensely! 👁️",
        target: "{user} is staring at {target}! 👁️",
    },
    think: {
        self: "{user} is thinking deeply... 🤔",
        target: "{user} is thinking about {target}... 🤔",
    },
    thumbsup: {
        self: "{user} gives a thumbs up! 👍",
        target: "{user} gives {target} a thumbs up! 👍",
    },
    wave: {
        self: "{user} waves hello! 👋",
        target: "{user} waves at {target}! 👋",
    },
    wink: {
        self: "{user} gives a cheeky wink! 😉",
        target: "{user} winks at {target}. 😉",
    },
    yawn: {
        self: "{user} lets out a big yawn! 🥱",
        target: "{user} yawns near {target}... contagious! 🥱",
    },
};

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "express",
    description: "Anime-style expressive commands",
    botPermissions: ["AttachFiles"],
    command: {
        enabled: false,
    },
    slashCommand: {
        enabled: true,
        options: Object.keys(messages).map(action => ({
            name: action,
            description: `Express ${action} anime-style`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "Direct it at someone? (optional)",
                    type: ApplicationCommandOptionType.User,
                    required: false,
                },
                {
                    name: "text",
                    description: "Optional message",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ],
        })),
    },

    async interactionRun({ interaction }) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");
        const text = interaction.options.getString("text");

        try {
            const { results } = await nekosBest.fetch(subcommand, 1);
            const gifUrl = results[0]?.url;
            const gifName = results[0]?.anime_name;

            let messageTemplate;

            if (user && user.id !== interaction.user.id) {
                messageTemplate = messages[subcommand]?.target || "{user} expresses {action} at {target}";
            } else {
                messageTemplate = messages[subcommand]?.self || "{user} expresses {action}";
            }

            // Replace placeholders
            const message = messageTemplate
                .replace(/{user}/g, `**${interaction.user.username}**`)
                .replace(/{target}/g, user ? `**${user.username}**` : "")
                .replace(/{action}/g, subcommand);

            const textParts = [
                message,
                text ? `💬 *${text}*` : null,
                gifName ? `🎞️ *Anime source: ${gifName}*` : null,
            ].filter(Boolean);

            await interaction.followUp({
                content: textParts.join("\n"),
                files: [new AttachmentBuilder(gifUrl, { name: "expression.gif" })],
            });

        } catch (error) {
            console.error(`[expression] API error for ${subcommand}:`, error);
            return interaction.followUp({
                content: "❌ Failed to fetch a reaction image. Please try again later.",
                ephemeral: true,
            });
        }
    },
};
