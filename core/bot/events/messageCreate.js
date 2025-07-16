const { handlePrefixCommand } = require("../handler");
const plugin = require("../index");
const db = require("../../db.service");

/**
 * @param {import('discord.js').Message} message
 */
module.exports = async (message) => {
    message.received_at = Date.now();
    message.isCommand = false;
    if (!message.guild || message.author.bot) return;
    const guild = message.guild;

    const [config, settings] = await Promise.all([plugin.getConfig(), db.getSettings(guild)]);

    if (!config["PREFIX_COMMANDS"]["ENABLED"]) return;

    // check for bot mentions
    const mention = `<@${guild.client.user.id}>`;
    const mentionNick = `<@!${guild.client.user.id}>`;

    if (
        message.content.trim() === mention ||
        message.content.trim() === mentionNick
    ) {
        message.channel.send(`> My prefix is \`${settings.prefix}\``);
    }


    if (message.content && message.content.toLowerCase().startsWith(settings.prefix.toLowerCase())) {
        const rawBody = message.content.slice(settings.prefix.length).trim();
        const normalizedBody = rawBody.toLowerCase().replace(/\s+/g, " ");
        const parts = normalizedBody.split(" ");

        let cmd = null;
        let invoke = "";

        // First try space-separated form (e.g., "lay help")
        for (let i = parts.length; i > 0; i--) {
            const tryInvoke = parts.slice(0, i).join(" ");
            const found = guild.client.commandManager.findPrefixCommand(tryInvoke);
            if (found) {
                cmd = found;
                invoke = tryInvoke;
                break;
            }
        }

        // If that failed, try no-space form (e.g., "layhelp")
        if (!cmd) {
            const noSpaceInvoke = parts.join("");
            const found = guild.client.commandManager.findPrefixCommand(noSpaceInvoke);
            if (found) {
                cmd = found;
                invoke = noSpaceInvoke;
            }
        }

        if (cmd) {
            // Check if plugin is enabled
            if (!settings.enabled_plugins.includes(cmd.plugin.name)) return;
            if (settings.disabled_prefix.includes(cmd.name)) return;

            message.isCommand = true;

            const invokeParts = invoke.split(" ").length;
            const args = parts.slice(invokeParts);

            message.args = args;
            handlePrefixCommand(message, cmd, settings.prefix);
        }
    }

}