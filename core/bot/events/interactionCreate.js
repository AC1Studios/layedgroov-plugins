const { MessageFlags } = require("discord.js");
const { handleSlashCommand, handleContext } = require("../handler");
const db = require("../../db.service");

/**
 * @param {import('discord.js').Interaction} interaction
 */
module.exports = async (interaction) => {
    const guild = interaction.guild;

    // Slash Commands
    if (interaction.isChatInputCommand()) {
        const cmd = interaction.client.commandManager.findSlashCommand(interaction.commandName);
        if (!cmd) {
            return interaction.reply({
                content: guild ? guild.getT("core:HANDLER.CMD_NOT_FOUND") : "Command not found.",
                flags: MessageFlags.Ephemeral,
            }).catch(() => { });
        }

        if (guild) {
            const settings = await db.getSettings(guild);

            // Plugin disabled
            if (!settings.enabled_plugins.includes(cmd.plugin.name)) {
                return interaction.reply({
                    content: guild.getT("core:HANDLER.PLUGIN_DISABLED"),
                    flags: MessageFlags.Ephemeral,
                }).catch(() => { });
            }

            // Command disabled
            if (settings.disabled_slash.includes(cmd.name)) {
                return interaction.reply({
                    content: guild.getT("core:HANDLER.CMD_DISABLED"),
                    flags: MessageFlags.Ephemeral,
                }).catch(() => { });
            }
        }

        await handleSlashCommand(interaction, cmd);
    }


    // Context Menu
    else if (interaction.isContextMenuCommand()) {
        const context = interaction.client.commandManager.findContextMenu(interaction.commandName);
        if (context) await handleContext(interaction, context);
        else
            return interaction
                .reply({ content: "An error has occurred", flags: MessageFlags.Ephemeral })
                .catch(() => { });
    }
};
