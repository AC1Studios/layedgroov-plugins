const {
    AttachmentBuilder,
    ApplicationCommandOptionType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const { Client } = require("nekos-best.js");
const nekosBest = new Client();

function getDescription(action) {
    const descriptions = {
        bite: "😁 Bite someone (or yourself?)",
        cuddle: "🤗 Cuddle someone (or want one?)",
        feed: "😋 Feed a member or yourself",
        hug: "🫂 Give someone a warm hug",
        kiss: "😽 Give a kiss (peck?)",
        pat: "🥰 Pat someone gently",
        peck: "😗 Peck someone on the cheek",
        poke: "🤭 Poke someone playfully",
        slap: "🫲🏻 Slap someone (gently!)",
        yeet: "😶 Yeet someone far away!",
        handhold: "🫱 Hold hands with someone",
        handshake: "🤝 Give a friendly handshake",
        punch: "🥊 Punch someone (nicely?)",
        tickle: "😝 Tickle someone!",
        highfive: "✋ High five a member",
        kick: "🦵 Kick a member playfully",
        shoot: "🔫 Shoot someone (safely!)",
    };
    return descriptions[action] || `Perform a ${action}`;
}

const interactive = [
    "bite", "cuddle", "feed", "hug", "kiss", "pat", "peck", "poke",
    "slap", "yeet", "handhold", "handshake", "punch", "tickle",
    "highfive", "kick", "shoot"
];

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
    name: "react",
    description: "Anime-style interactive actions",
    botPermissions: ["AttachFiles"],
    command: { enabled: false },
    slashCommand: {
        enabled: true,
        options: interactive.map(action => ({
            name: action,
            description: getDescription(action),
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "Mention someone (optional)",
                    type: ApplicationCommandOptionType.User,
                    required: false,
                },
                {
                    name: "text",
                    description: "Optional message",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ]
        })),
    },

    async interactionRun({ interaction }) {
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");
        const text = interaction.options.getString("text");

        const selfMessages = {
            bite: "You're biting yourself? That's... interesting...",
            cuddle: "Aww, do you need someone to cuddle with?",
            feed: "I can feed you if you want! Just ask nicely~",
            hug: "Here's a big hug from me! You deserve it!",
            kiss: "Kissing yourself in the mirror? How vain~",
            pat: "Do you need some headpats? Here you go~ *pat pat*",
            peck: "Giving yourself a kiss? That's kinda sad...",
            poke: "Poking yourself isn't very fun, is it?",
            slap: "Don't slap yourself! You're wonderful!",
            yeet: "Trying to yeet yourself into the void?",
        };

        try {
            const { results } = await nekosBest.fetch(subcommand, 1);
            const gifUrl = results[0]?.url;
            const gifName = results[0]?.anime_name;

            const attachment = new AttachmentBuilder(gifUrl, { name: "interaction.gif" });

            let message;
            let includeGif = false;

            const allowButton = user && user.id !== interaction.user.id;

            if (allowButton) {
                message = `**${interaction.user.username}** ${subcommand}s **${user.username}**`;
                includeGif = true;
            } else {
                message = selfMessages[subcommand] || `**${interaction.user.username}** ${subcommand}s themselves?`;
            }

            const textParts = [
                message,
                (allowButton && text) ? `💬 *${text}*` : null,
                (includeGif && gifName) ? `🎞️ *Anime source: ${gifName}*` : null
            ].filter(Boolean);

            const components = [];

            if (allowButton) {
                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`react_back_${subcommand}`)
                            .setLabel(`${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)} Back`)
                            .setStyle(ButtonStyle.Secondary) // Black/Grey button
                    )
                );
            }

            const reply = await interaction.followUp({
                content: textParts.join("\n"),
                files: includeGif ? [attachment] : [],
                components,
                fetchReply: true
            });

            if (allowButton) {
                const collector = reply.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 60_000, // 1 minute
                });

                collector.on("collect", async (btnInteraction) => {
                    if (btnInteraction.user.id !== user.id) {
                        return btnInteraction.reply({
                            content: "❌ You can't use this button.",
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await btnInteraction.deferUpdate();

                    const customId = btnInteraction.customId;
                    const action = customId.replace("react_back_", "");

                    try {
                        const { results } = await nekosBest.fetch(action, 1);

                        if (!results || !results[0]?.url) {
                            throw new Error(`No results returned for '${action}'`);
                        }

                        const backGif = new AttachmentBuilder(results[0].url, { name: "back.gif" });
                        const backText = `**${user.username}** ${action}s **${interaction.user.username}** back!\n🎞️ *Anime source: ${results[0].anime_name}*`;

                        await interaction.followUp({
                            content: backText,
                            files: [backGif]
                        });

                        await reply.edit({
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(customId)
                                        .setLabel(`${action.charAt(0).toUpperCase() + action.slice(1)} Back`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(true)
                                )
                            ]
                        });

                        collector.stop();
                    } catch (err) {
                        console.error(`[react_back][${action}] fetch failed:`, err);
                        await interaction.followUp({
                            content: `❌ Failed to fetch a response for **${action} back**.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                });

                collector.on("end", async () => {
                    if (reply.editable) {
                        await reply.edit({
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`react_back_${subcommand}`)
                                        .setLabel(`${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)} Back`)
                                        .setStyle(ButtonStyle.Secondary)
                                        .setDisabled(true)
                                )
                            ]
                        });
                    }
                });
            }

        } catch (error) {
            console.error(`[interaction] API error for ${subcommand}:`, error);
            return interaction.followUp({
                content: "❌ Failed to fetch a reaction image. Please try again later.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
