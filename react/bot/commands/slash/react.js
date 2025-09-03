const {
    AttachmentBuilder,
    ApplicationCommandOptionType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const path = require("path");
const emotes = require(path.join(__dirname, "../../emotes.json")); // Load emotes.json

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
        global: true,
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

            const attachment = gifUrl ? new AttachmentBuilder(gifUrl, { name: "interaction.gif" }) : null;

            const allowButton = user && user.id !== interaction.user.id;
            const btnCustomId = `react_back_${subcommand}`;

            const message = allowButton
                ? `**${interaction.user.username}** ${subcommand}s **${user.username}**`
                : selfMessages[subcommand] || `**${interaction.user.username}** ${subcommand}s themselves?`;

            const textParts = [
                message,
                (allowButton && text) ? `💬 *${text}*` : null,
                (allowButton && gifName) ? `🎞️ *Anime source: ${gifName}*` : null
            ].filter(Boolean);

            const components = [];
            if (allowButton) {
                const emoteArray = emotes[subcommand] || [];
                const randomEmote = emoteArray.length > 0
                    ? emoteArray[Math.floor(Math.random() * emoteArray.length)]
                    : null;

                const button = new ButtonBuilder()
                    .setCustomId(btnCustomId)
                    .setLabel(`${subcommand.charAt(0).toUpperCase() + subcommand.slice(1)} Back`.trim())
                    .setStyle(ButtonStyle.Secondary);

                if (randomEmote) button.setEmoji(randomEmote); // Only set emoji if it exists

                components.push(new ActionRowBuilder().addComponents(button));
            }

            const reply = await interaction.followUp({
                content: textParts.join("\n"),
                files: attachment ? [attachment] : [],
                components,
                fetchReply: true
            });

            if (!allowButton) return;

            let handled = false;

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button
            });

            collector.on("collect", async (btnInteraction) => {
                if (btnInteraction.customId !== btnCustomId) return;

                if (btnInteraction.user.id !== user.id) {
                    return btnInteraction.reply({
                        content: "❌ You can't use this button.",
                        ephemeral: true
                    });
                }

                if (handled) {
                    return btnInteraction.reply({
                        content: "❌ This button was already used.",
                        ephemeral: true
                    });
                }

                handled = true;

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(btnCustomId)
                        .setLabel(btnInteraction.component.label)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                try {
                    await btnInteraction.update({ components: [disabledRow] });
                } catch {}

                // Fetch back GIF
                try {
                    const { results: backResults } = await nekosBest.fetch(subcommand, 1);
                    const backUrl = backResults?.[0]?.url;
                    const backName = backResults?.[0]?.anime_name;

                    const backAttachment = backUrl ? new AttachmentBuilder(backUrl, { name: "back.gif" }) : null;

                    // Random emote for the back text
                    let emoteText = "";
                    const emoteArray = emotes[subcommand] || [];
                    if (emoteArray.length > 0) {
                        const randomIndex = Math.floor(Math.random() * emoteArray.length);
                        emoteText = ` ${emoteArray[randomIndex]}`;
                    }

                    const backText = `**${user.username}** ${subcommand}s **${interaction.user.username}** back${emoteText}` +
                        (backName ? `\n🎞️ *Anime source: ${backName}*` : "");

                    await interaction.followUp({
                        content: backText,
                        files: backAttachment ? [backAttachment] : []
                    });

                } catch (err) {
                    console.error(`[react_back][${subcommand}] fetch failed:`, err);
                    try {
                        await btnInteraction.followUp({
                            content: `❌ Failed to fetch a response for **${subcommand} back**.`,
                            ephemeral: true
                        });
                    } catch {}
                }
            });
        } catch (error) {
            console.error(`[interaction] API error for ${subcommand}:`, error);
            return interaction.followUp({
                content: "❌ Failed to fetch a reaction image. Please try again later.",
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
