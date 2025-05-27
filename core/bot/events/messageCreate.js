const { handlePrefixCommand } = require("../handler");
const plugin = require("../index");

/**
 * @param {import('discord.js').Message} message
 */
module.exports = async (message) => {
    message.received_at = Date.now();
    message.isCommand = false;
    if (!message.guild || message.author.bot) return;
    const guild = message.guild;

    const [config, settings] = await Promise.all([plugin.getConfig(), plugin.getSettings(guild)]);

    if (!config["PREFIX_COMMANDS"]["ENABLED"]) return;

    // Check for bot mentions
    if (message.content.includes(`${guild.client.user.id}`)) {
        message.channel.send(`> My prefix is \`${settings.prefix}\``);
    }

    // Case-insensitive prefix check + optional space handling
    const prefixRegex = new RegExp(`^${settings.prefix}\\s*`, "i"); // "i" flag = case-insensitive
    const prefixMatch = message.content.match(prefixRegex);

    if (prefixMatch) {
        // Extract the command and arguments
        const commandAndArgs = message.content.slice(prefixMatch[0].length).trim();
        const invoke = commandAndArgs.split(/\s+/)[0]?.toLowerCase();

        if (invoke) {
            const cmd = guild.client.commandManager.findPrefixCommand(invoke);
            if (cmd) {
                // Check if the plugin is disabled
                if (!settings.enabled_plugins.includes(cmd.plugin.name)) return;

                // Check if the command is disabled
                if (settings.disabled_prefix.includes(cmd.name)) return;

                message.isCommand = true;
                handlePrefixCommand(message, cmd, settings.prefix);
            }
        }
    }
};