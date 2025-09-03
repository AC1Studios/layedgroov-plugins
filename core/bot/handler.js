const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");
const { MiscUtils, EmbedUtils } = require("strange-sdk/utils");

const cooldownCache = new Map();
const OWNER_IDS = process.env.OWNER_IDS?.split(",").map((id) => id.trim());

/**
 * Handles prefix commands
 */
async function handlePrefixCommand(message, cmd, prefix) {
    const body = message.content.slice(prefix.length).trim();
    const args = typeof message.args !== "undefined"
        ? message.args.map(arg => arg.trim())
        : body.split(/\s+/).slice(1);
    const invoke = body.split(/\s+/)[0].toLowerCase();

    const data = { prefix, invoke };

    // Allow DMs
    const canSend = message.channel.permissionsFor(message.guild?.members?.me ?? message.author);
    if (message.guild && (!canSend || !canSend.has("SendMessages"))) return;

    // Validations
    if (cmd.validations) {
        for (const validation of cmd.validations) {
            if (!validation.callback(message)) {
                return message.reply(validation.message);
            }
        }
    }

    // Owner check
    if (cmd.category === "OWNER" && !OWNER_IDS.includes(message.author.id)) {
        return message.replyT("core:HANDLER.OWNER_ONLY");
    }

    // User permissions
    if (cmd.userPermissions?.length > 0 && message.guild) {
        if (!message.channel.permissionsFor(message.member).has(cmd.userPermissions)) {
            return message.replyT("core:HANDLER.USER_PERMISSIONS", {
                permissions: MiscUtils.parsePermissions(cmd.userPermissions),
            });
        }
    }

    // Bot permissions
    if (cmd.botPermissions?.length > 0 && message.guild) {
        if (!message.channel.permissionsFor(message.guild.members.me).has(cmd.botPermissions)) {
            return message.replyT("core:HANDLER.BOT_PERMISSIONS", {
                permissions: MiscUtils.parsePermissions(cmd.botPermissions),
            });
        }
    }

    // Min args
    if (cmd.command.minArgsCount > args.length) {
        const usageEmbed = getCommandUsage(message.guild, cmd, prefix, invoke);
        return message.reply({ embeds: [usageEmbed] });
    }

    // Cooldown
    if (cmd.cooldown > 0) {
        const remaining = getRemainingCooldown("cmd", message.author.id, cmd);
        if (remaining > 0) {
            return message.replyT("core:HANDLER.COOLDOWN", {
                time: MiscUtils.timeformat(remaining),
            });
        }
    }

    try {
        const context = { message, prefix, invoke, args };
        await cmd.messageRun(context);
    } catch (ex) {
        message.client.logger.error("messageRun", ex);
        message.replyT("core:HANDLER.ERROR");
    } finally {
        if (cmd.cooldown > 0) applyCooldown("cmd", message.author.id, cmd);
    }
}

/**
 * Handles slash commands (DM-safe)
 */
async function handleSlashCommand(interaction, cmd) {
    const guild = interaction.guild;

    // Validations
    if (cmd.validations) {
        for (const validation of cmd.validations) {
            if (!validation.callback(interaction)) {
                return interaction.reply({
                    content: validation.message,
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    }

    // Owner
    if (cmd.category === "OWNER" && !OWNER_IDS.includes(interaction.user.id)) {
        return interaction.reply({
            content: guild?.getT("core:HANDLER.OWNER_ONLY") ?? "Owner only command",
            flags: MessageFlags.Ephemeral,
        });
    }

    // User permissions (only in guilds)
    if (interaction.member && guild && cmd.userPermissions?.length > 0) {
        if (!interaction.member.permissions.has(cmd.userPermissions)) {
            return interaction.reply({
                content: guild.getT("core:HANDLER.USER_PERMISSIONS", {
                    permissions: MiscUtils.parsePermissions(cmd.userPermissions),
                }),
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    // Bot permissions (only in guilds)
    if (cmd.botPermissions?.length > 0 && guild) {
        if (!guild.members.me.permissions.has(cmd.botPermissions)) {
            return interaction.reply({
                content: guild.getT("core:HANDLER.BOT_PERMISSIONS", {
                    permissions: MiscUtils.parsePermissions(cmd.botPermissions),
                }),
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    // Cooldown
    if (cmd.cooldown > 0) {
        const remaining = getRemainingCooldown("cmd", interaction.user.id, cmd);
        if (remaining > 0) {
            return interaction.reply({
                content: guild?.getT("core:HANDLER.COOLDOWN", {
                    time: MiscUtils.timeformat(remaining),
                }) ?? `Cooldown: ${MiscUtils.timeformat(remaining)}`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    try {
        await interaction.deferReply({
            flags: cmd.slashCommand?.ephemeral ? MessageFlags.Ephemeral : 0,
        });

        const context = { interaction };
        await cmd.interactionRun(context);
    } catch (ex) {
        interaction.client.logger.error("interactionRun", ex);
        await interaction.followUp({
            content: "An error occurred while running the command.",
            ephemeral: true,
        });
    } finally {
        if (cmd.cooldown > 0) applyCooldown("cmd", interaction.user.id, cmd);
    }
}

/**
 * Handles context menu commands
 */
async function handleContext(interaction, context) {
    const guild = interaction.guild;

    // Cooldown
    if (context.cooldown) {
        const remaining = getRemainingCooldown("ctx", interaction.user.id, context);
        if (remaining > 0) {
            return interaction.reply({
                content: guild?.getT("core:HANDLER.COOLDOWN", {
                    time: MiscUtils.timeformat(remaining),
                }) ?? `Cooldown: ${MiscUtils.timeformat(remaining)}`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    // User permissions
    if (interaction.member && context.userPermissions?.length > 0) {
        if (!interaction.member.permissions.has(context.userPermissions)) {
            return interaction.reply({
                content: guild?.getT("core:HANDLER.USER_PERMISSIONS", {
                    permissions: MiscUtils.parsePermissions(context.userPermissions),
                }) ?? "You do not have permission to run this command",
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    try {
        await interaction.deferReply({ flags: context.ephemeral ? MessageFlags.Ephemeral : 0 });
        await context.run({ interaction });
    } catch (ex) {
        interaction.followUp({
            content: "An error occurred while running the command.",
            ephemeral: true,
        });
        interaction.client.logger.error("contextRun", ex);
    } finally {
        if (context.cooldown) applyCooldown("ctx", interaction.user.id, context);
    }
}

/**
 * Cooldown utils
 */
function applyCooldown(type, memberId, cmd) {
    const key = type + "|" + cmd.name + "|" + memberId;
    cooldownCache.set(key, Date.now());
}

function getRemainingCooldown(type, memberId, cmd) {
    const key = type + "|" + cmd.name + "|" + memberId;
    if (cooldownCache.has(key)) {
        const elapsed = (Date.now() - cooldownCache.get(key)) * 0.001;
        if (elapsed > cmd.cooldown) {
            cooldownCache.delete(key);
            return 0;
        }
        return cmd.cooldown - elapsed;
    }
    return 0;
}

module.exports = {
    handlePrefixCommand,
    handleSlashCommand,
    handleContext,
    applyCooldown,
    getRemainingCooldown,
};
