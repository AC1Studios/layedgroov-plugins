const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Message,
    ButtonBuilder,
    CommandInteraction,
    ApplicationCommandOptionType,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const { getCommandUsage, getSlashUsage } = require("../handler");
const { EmbedUtils } = require("strange-sdk/utils");
const db = require("../../db.service");

const CMDS_PER_PAGE = 5;
const IDLE_TIMEOUT = 30;

/**
 * @type {import('strange-sdk').CommandType}
 */
module.exports = {
    name: "help",
    description: "core:HELP.DESCRIPTION",
    botPermissions: ["EmbedLinks"],
    validations: [],
    command: {
        enabled: true,
        usage: "[plugin|command]",
    },
    slashCommand: {
        enabled: true,
        options: [
            {
                name: "plugin",
                description: "core:HELP.PLUGIN_DESC",
                required: false,
                type: ApplicationCommandOptionType.String,
            },
            {
                name: "command",
                description: "core:HELP.COMMAND_DESC",
                required: false,
                type: ApplicationCommandOptionType.String,
            },
        ],
    },

    async messageRun({ message, args, prefix }) {
        let trigger = args[0];

        // !help
        if (!trigger) {
            const { disabled_prefix } = await db.getSettings(message.guild);
            const response = await getHelpMenu(message);
            const sentMsg = await message.reply(response);
            return waiter(sentMsg, message.author.id, prefix, disabled_prefix);
        }

        // check if category help (!help cat)
        const settings = await db.getSettings(message.guild);
        const { enabled_plugins, disabled_prefix } = settings;
        if (
            message.client.pluginManager.plugins.some(
                (p) => p.name === trigger && !p.ownerOnly && enabled_plugins.includes(p.name),
            )
        ) {
            return pluginWaiter(message, trigger, prefix, disabled_prefix);
        }

        // check if command help (!help cmdName)
        const cmd = message.client.prefixCommands.get(trigger);
        if (cmd && !disabled_prefix.includes(trigger)) {
            const embed = getCommandUsage(message.guild, cmd, prefix, trigger);
            return message.reply({ embeds: [embed] });
        }

        // No matching command/category found
        await message.replyT("core:HELP.NOT_FOUND");
    },

    async interactionRun({ interaction }) {
        let pluginName = interaction.options.getString("plugin");
        let cmdName = interaction.options.getString("command");

        // !help
        if (!cmdName && !pluginName) {
            const { disabled_slash } = await db.getSettings(interaction.guild);
            const response = await getHelpMenu(interaction);
            const sentMsg = await interaction.followUp(response);
            return waiter(sentMsg, interaction.user.id, null, disabled_slash);
        }

        // check if category help (!help cat)
        const settings = await db.getSettings(interaction.guild);
        const { enabled_plugins, disabled_slash } = settings;
        if (pluginName) {
            if (
                interaction.client.pluginManager.plugins.some(
                    (p) =>
                        p.name === pluginName && !p.ownerOnly && enabled_plugins.includes(p.name),
                )
            ) {
                return pluginWaiter(interaction, pluginName, disabled_slash);
            }
            return interaction.followUpT("core:HELP.NOT_FOUND");
        }

        // check if command help (!help cmdName)
        if (cmdName) {
            const cmd = interaction.client.slashCommands.get(cmdName);
            if (cmd && !disabled_slash.includes(cmd.name)) {
                const embed = getSlashUsage(interaction.guild, cmd);
                return interaction.followUp({ embeds: [embed] });
            }
            return interaction.followUpT("core:HELP.COMMAND_NOT_FOUND");
        }
    },
};

/**
 * @param {Message | CommandInteraction} arg0
 */
async function getHelpMenu({ client, guild }, usedPrefix = null) {
    const { enabled_plugins } = await guild.getSettings("core");

    const options = [];
    for (const plugin of client.pluginManager.plugins.filter((p) => !p.ownerOnly)) {
        if (!enabled_plugins.includes(plugin.name)) continue;
        options.push({
            label: plugin.name,
            value: plugin.name,
            description: guild.getT("core:HELP.MENU_DESC", { plugin: plugin.name }),
        });
    }

    const menuRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("help-menu")
            .setPlaceholder(guild.getT("core:HELP.MENU_PLACEHOLDER"))
            .addOptions(options),
    );

    // Buttons Row: Previous, Home (disabled initially), Next
    let components = [
        new ButtonBuilder()
            .setCustomId("previousBtn")
            .setEmoji("<:Leftarrow:1394891896278487040>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("homeBtn")
            .setEmoji("<:Home:1394891882533884036>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true), // Disabled on main menu
        new ButtonBuilder()
            .setCustomId("nextBtn")
            .setEmoji("<:Rightarrow:1394891908140236911>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
    ];

    let buttonsRow = new ActionRowBuilder().addComponents(components);
    const config = await client.pluginManager.getPlugin("core").getConfig();

    const embed = EmbedUtils.embed()
        .setThumbnail(client.user.displayAvatarURL())
        .setImage("https://media.discordapp.net/attachments/925107435822272522/1095401318044139600/layedgroov_banner.png")
        .setDescription(
            `Hello I am ${guild.members.me.displayName}!\n` +
            `- **__Select a category from the dropdown menu below!__**\n` +
            `- **__Use the Arrows to go to the next page!__**\n` +
            `- **__Select the Home button to go back to this page__**\n` +
            `- **__For more details on any command, use ${usedPrefix ?? ""}help <command>.__**\n\n` +
            `**Invite Me:** [Here](${client.getInvite()})\n` +
            `**Enable plugins here:** [Dashboard](https://layedgroov.up.railway.app)\n` +
            `**Support Server:** [Join](${config["SUPPORT_SERVER"]})`
        );

    return {
        embeds: [embed],
        components: [menuRow, buttonsRow],
    };
};

const waiter = (msg, userId, prefix, disabledCmds) => {
    const collector = msg.channel.createMessageComponentCollector({
        filter: (reactor) => reactor.user.id === userId && msg.id === reactor.message.id,
        idle: IDLE_TIMEOUT * 1000,
        dispose: true,
        time: 5 * 60 * 1000,
    });

    let arrEmbeds = [];
    let currentPage = 0;
    let menuRow = msg.components[0];
    let buttonsRow = msg.components[1];

    // Helper to rebuild buttons row based on current page and embeds length
    const buildButtonsRow = () => {
        const previousBtn = new ButtonBuilder()
            .setCustomId("previousBtn")
            .setEmoji("<:Leftarrow:1394891896278487040>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0);

        const homeBtn = new ButtonBuilder()
            .setCustomId("homeBtn")
            .setEmoji("<:Home:1394891882533884036>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false);

        const nextBtn = new ButtonBuilder()
            .setCustomId("nextBtn")
            .setEmoji("<:Rightarrow:1394891908140236911>")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === arrEmbeds.length - 1);

        return new ActionRowBuilder().addComponents([previousBtn, homeBtn, nextBtn]);
    };

    collector.on("collect", async (response) => {
        if (!["help-menu", "previousBtn", "nextBtn", "homeBtn"].includes(response.customId)) return;
        await response.deferUpdate();

        switch (response.customId) {
            case "help-menu": {
                const cat = response.values[0];
                arrEmbeds = prefix
                    ? getPrefixPluginCommandEmbed(msg.guild, cat, prefix, disabledCmds)
                    : getSlashPluginCommandsEmbed(msg.guild, cat, disabledCmds);
                currentPage = 0;

                buttonsRow = buildButtonsRow();

                if (msg.editable) {
                    await msg.edit({
                        embeds: [arrEmbeds[currentPage]],
                        components: [menuRow, buttonsRow],
                    });
                }
                break;
            }

            case "previousBtn":
                if (currentPage !== 0) {
                    --currentPage;
                    buttonsRow = buildButtonsRow();

                    if (msg.editable) {
                        await msg.edit({
                            embeds: [arrEmbeds[currentPage]],
                            components: [menuRow, buttonsRow],
                        });
                    }
                }
                break;

            case "nextBtn":
                if (currentPage < arrEmbeds.length - 1) {
                    ++currentPage;
                    buttonsRow = buildButtonsRow();

                    if (msg.editable) {
                        await msg.edit({
                            embeds: [arrEmbeds[currentPage]],
                            components: [menuRow, buttonsRow],
                        });
                    }
                }
                break;

            case "homeBtn": {
                // Reset variables
                arrEmbeds = [];
                currentPage = 0;

                // Get main menu embed + components fresh
                const mainMenu = await getHelpMenu(msg, prefix);

                // Update references to menuRow and buttonsRow
                menuRow = mainMenu.components[0];
                buttonsRow = mainMenu.components[1];

                if (msg.editable) {
                    await msg.edit(mainMenu);
                }
                break;
            }
        }
    });

    collector.on("end", () => {
        if (!msg.guild || !msg.channel) return;
        return msg.editable && msg.edit({ components: [] });
    });
};

/**
 * Returns an array of message embeds for slash commands in a plugin
 * @param {import('discord.js').Guild} guild
 * @param {string} pluginName
 * @param {string[]} disabledCmds
 */
function getSlashPluginCommandsEmbed(guild, pluginName, disabledCmds) {
    const commands = [
        ...guild.client.pluginManager.plugins.find((p) => p.name === pluginName).commands,
    ].filter((cmd) => cmd.slashCommand?.enabled && !disabledCmds.includes(cmd.name));

    if (commands.length === 0) {
        const embed = EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${pluginName.toUpperCase()}` })
            .setDescription(guild.getT("core:HELP.EMPTY_CATEGORY"));

        return [embed];
    }

    const arrSplitted = [];
    const arrEmbeds = [];

    while (commands.length) {
        let toAdd = commands.splice(
            0,
            commands.length > CMDS_PER_PAGE ? CMDS_PER_PAGE : commands.length,
        );

        toAdd = toAdd.map((cmd) => {
            const subCmds = cmd.slashCommand.options?.filter(
                (opt) => opt.type === ApplicationCommandOptionType.Subcommand,
            );
            const subCmdsString = subCmds?.map((s) => s.name).join(", ");
            return `\`/${cmd.name}\`\n ❯ **${guild.getT("core:HELP.CMD_DESC")}**: ${guild.getT(cmd.description)}\n ${!subCmds?.length
                ? "\n"
                : `❯ **${guild.getT("core:HELP.CMD_SUBCOMMANDS")} [${subCmds?.length}]**: ${subCmdsString}\n`
                } `;
        });

        arrSplitted.push(toAdd);
    }

    arrSplitted.forEach((item, index) => {
        const embed = EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${pluginName.toUpperCase()}` })
            .setDescription(item.join("\n"))
            .setFooter({
                text: guild.getT("core:HELP.PLUGIN_EMBED_FOOTER", {
                    page: index + 1,
                    pages: arrSplitted.length,
                    prefix: "/",
                }),
            });
        arrEmbeds.push(embed);
    });

    return arrEmbeds;
}

/**
 * Returns an array of message embeds for prefix commands in a plugin
 * @param {import('discord.js').Guild} guild
 * @param {string} pluginName
 * @param {string} prefix
 * @param {string[]} disabledCmds
 */
function getPrefixPluginCommandEmbed(guild, pluginName, prefix, disabledCmds) {
    const commands = [
        ...guild.client.pluginManager.plugins.find((p) => p.name === pluginName).commands,
    ].filter((cmd) => cmd.command?.enabled && !disabledCmds.includes(cmd.name));

    if (commands.length === 0) {
        const embed = EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${guild.getT(pluginName.toLowerCase() + ":TITLE")}` })
            .setDescription(guild.getT("core:HELP.EMPTY_CATEGORY"));

        return [embed];
    }

    const arrSplitted = [];
    const arrEmbeds = [];

    while (commands.length) {
        let toAdd = commands.splice(
            0,
            commands.length > CMDS_PER_PAGE ? CMDS_PER_PAGE : commands.length,
        );
        toAdd = toAdd.map((cmd) => {
            const subCmds = cmd.command.subcommands;
            const subCmdsString = subCmds?.map((s) => s.trigger.split(" ")[0]).join(", ");
            return `\`${prefix}${cmd.name}\`\n ❯ **${guild.getT("core:HELP.CMD_DESC")}**: ${guild.getT(cmd.description)}\n ${!subCmds?.length
                ? "\n"
                : `❯ **${guild.getT("core:HELP.CMD_SUBCOMMANDS")} [${subCmds?.length}]**: ${subCmdsString}\n`
                } `;
        });
        arrSplitted.push(toAdd);
    }

    arrSplitted.forEach((item, index) => {
        const embed = EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${guild.getT(pluginName.toLowerCase() + ":TITLE")}` })
            .setDescription(item.join("\n"))
            .setFooter({
                text: guild.getT("core:HELP.PLUGIN_EMBED_FOOTER", {
                    page: index + 1,
                    pages: arrSplitted.length,
                    prefix,
                }),
            });

        arrEmbeds.push(embed);
    });

    return arrEmbeds;
}
