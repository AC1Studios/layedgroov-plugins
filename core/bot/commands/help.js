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

        if (!trigger) {
            const response = await getHelpMenu({ client: message.client, guild: message.guild, prefix });
            const sentMsg = await message.reply(response);
            return waiter(sentMsg, message.author.id, prefix);
        }

        const enabledPlugins = await message.guild.getEnabledPlugins();
        if (message.client.pluginManager.plugins.some(
            (p) => p.name === trigger && !p.ownerOnly && enabledPlugins.includes(p.name),
        )) {
            return pluginWaiter(message, trigger, prefix);
        }

        const cmd = message.client.prefixCommands.get(trigger);
        const settings = await db.getSettings(message.guild);
        if (cmd && !settings.disabled_prefix.includes(trigger)) {
            const embed = getCommandUsage(message.guild, cmd, prefix, trigger);
            return message.reply({ embeds: [embed] });
        }

        await message.replyT("core:HELP.NOT_FOUND");
    },

    async interactionRun({ interaction }) {
        let pluginName = interaction.options.getString("plugin");
        let cmdName = interaction.options.getString("command");

        if (!cmdName && !pluginName) {
            const response = await getHelpMenu(interaction);
            const sentMsg = await interaction.followUp(response);
            return waiter(sentMsg, interaction.user.id);
        }

        const enabledPlugins = await interaction.guild.getEnabledPlugins();
        if (pluginName) {
            if (interaction.client.pluginManager.plugins.some(
                (p) => p.name === pluginName && !p.ownerOnly && enabledPlugins.includes(p.name),
            )) {
                return pluginWaiter(interaction, pluginName);
            }
            return interaction.followUpT("core:HELP.NOT_FOUND");
        }

        if (cmdName) {
            const cmd = interaction.client.slashCommands.get(cmdName);
            const settings = await db.getSettings(interaction.guild);
            if (cmd && !settings.disabled_slash.includes(cmd.name)) {
                const embed = getSlashUsage(interaction.guild, cmd);
                return interaction.followUp({ embeds: [embed] });
            }
            return interaction.followUpT("core:HELP.COMMAND_NOT_FOUND");
        }
    },
};

async function getHelpMenu({ client, guild, prefix }) {
    const enabled_plugins = await guild.getEnabledPlugins();
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

    const buttonsRow = new ActionRowBuilder().addComponents([
        new ButtonBuilder()
            .setCustomId("previousBtn")
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("nextBtn")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId("homeBtn")
            .setLabel("Home")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    ]);

    const config = await client.pluginManager.getPlugin("core").getConfig();
    const usedPrefix = prefix || "/";

    const embed = EmbedUtils.embed()
        .setThumbnail(client.user.displayAvatarURL())
        .setImage("https://media.discordapp.net/attachments/925107435822272522/1095401318044139600/layedgroov_banner.png")
        .setDescription(
            `Hello I am ${guild.members.me.displayName}!\n` +
            `- **__Select a category from the dropdown menu below!__**\n` +
            `- **__Use the Arrows to go to the next page!__**\n` +
            `- **__Select the Home button to go back to this page__**\n` +
            `- **__For more details on any command, use ${usedPrefix}help <command>.__**\n` +
            `- **__For any further help join our support server [Join](${config["SUPPORT_SERVER"]})__**!\n` +
            `**Invite Me:** [Here](${client.getInvite()})\n` +
            `**Enable plugins here:** [Dashboard](https://layedgroov.up.railway.app/dashboard)`
        );

    return {
        embeds: [embed],
        components: [menuRow, buttonsRow],
    };
}

const waiter = (msg, userId, prefix) => {
    const collector = msg.channel.createMessageComponentCollector({
        filter: (reactor) => reactor.user.id === userId && msg.id === reactor.message.id,
        idle: IDLE_TIMEOUT * 1000,
        dispose: true,
        time: 5 * 60 * 1000,
    });

    let arrEmbeds = [];
    let currentPage = 0;
    let menuRow = msg.components[0];

    collector.on("collect", async (response) => {
        if (!["help-menu", "previousBtn", "nextBtn", "homeBtn"].includes(response.customId)) return;
        await response.deferUpdate();

        switch (response.customId) {
            case "help-menu": {
                const cat = response.values[0];
                arrEmbeds = prefix
                    ? getPrefixPluginCommandEmbed(msg.guild, cat, prefix)
                    : getSlashPluginCommandsEmbed(msg.guild, cat);
                currentPage = 0;

                const buttonsRow = new ActionRowBuilder().addComponents([
                    new ButtonBuilder()
                        .setCustomId("previousBtn")
                        .setEmoji("⬅️")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(arrEmbeds.length <= 1),
                    new ButtonBuilder()
                        .setCustomId("nextBtn")
                        .setEmoji("➡️")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(arrEmbeds.length <= 1),
                    new ButtonBuilder()
                        .setCustomId("homeBtn")
                        .setLabel("Home")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(false)
                ]);

                await msg.edit({
                    embeds: [arrEmbeds[currentPage]],
                    components: [menuRow, buttonsRow],
                });
                break;
            }

            case "previousBtn":
                if (currentPage !== 0) {
                    --currentPage;
                    await msg.edit({
                        embeds: [arrEmbeds[currentPage]],
                        components: msg.components,
                    });
                }
                break;

            case "nextBtn":
                if (currentPage < arrEmbeds.length - 1) {
                    currentPage++;
                    await msg.edit({
                        embeds: [arrEmbeds[currentPage]],
                        components: msg.components,
                    });
                }
                break;

            case "homeBtn":
                const homeResponse = await getHelpMenu({
                    client: msg.client,
                    guild: msg.guild,
                    prefix
                });
                arrEmbeds = [];
                currentPage = 0;
                await msg.edit(homeResponse);
                break;
        }
    });

    collector.on("end", () => {
        if (!msg.guild || !msg.channel) return;
        msg.edit({ components: [] }).catch(() => { });
    });
};

const pluginWaiter = async (arg0, pluginName, prefix) => {
    let arrEmbeds = prefix
        ? getPrefixPluginCommandEmbed(arg0.guild, pluginName, prefix)
        : getSlashPluginCommandsEmbed(arg0.guild, pluginName);

    let currentPage = 0;
    const buttonsRow = new ActionRowBuilder().addComponents([
        new ButtonBuilder()
            .setCustomId("previousBtn")
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(arrEmbeds.length <= 1),
        new ButtonBuilder()
            .setCustomId("nextBtn")
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(arrEmbeds.length <= 1),
        new ButtonBuilder()
            .setCustomId("homeBtn")
            .setLabel("Home")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false)
    ]);

    const reply = {
        embeds: [arrEmbeds[currentPage]],
        components: [buttonsRow],
    };

    const sentMsg = prefix ? await arg0.reply(reply) : await arg0.followUp(reply);
    const authorId = prefix ? arg0.author.id : arg0.user.id;

    const collector = arg0.channel.createMessageComponentCollector({
        filter: (reactor) => reactor.user.id === authorId && sentMsg.id === reactor.message.id,
        componentType: ComponentType.Button,
        idle: IDLE_TIMEOUT * 1000,
        dispose: true,
        time: 5 * 60 * 1000,
    });

    collector.on("collect", async (response) => {
        if (!["previousBtn", "nextBtn", "homeBtn"].includes(response.customId)) return;
        await response.deferUpdate();

        switch (response.customId) {
            case "previousBtn":
                if (currentPage !== 0) {
                    --currentPage;
                    await sentMsg.edit({
                        embeds: [arrEmbeds[currentPage]],
                        components: [buttonsRow],
                    });
                }
                break;

            case "nextBtn":
                if (currentPage < arrEmbeds.length - 1) {
                    currentPage++;
                    await sentMsg.edit({
                        embeds: [arrEmbeds[currentPage]],
                        components: [buttonsRow],
                    });
                }
                break;

            case "homeBtn":
                const homeResponse = await getHelpMenu({
                    client: arg0.client,
                    guild: arg0.guild,
                    prefix
                });
                await sentMsg.edit(homeResponse);
                break;
        }
    });

    collector.on("end", () => {
        if (!sentMsg.guild || !sentMsg.channel) return;
        sentMsg.edit({ components: [] }).catch(() => { });
    });
};

function getSlashPluginCommandsEmbed(guild, pluginName) {
    const commands = [
        ...guild.client.pluginManager.plugins.find((p) => p.name === pluginName).commands,
    ].filter((cmd) => cmd.slashCommand?.enabled);

    if (commands.length === 0) {
        return [EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${pluginName.toUpperCase()}` })
            .setDescription(guild.getT("core:HELP.EMPTY_CATEGORY"))];
    }

    const arrSplitted = [];
    const arrEmbeds = [];

    while (commands.length) {
        let toAdd = commands.splice(0, Math.min(CMDS_PER_PAGE, commands.length));
        toAdd = toAdd.map((cmd) => {
            const subCmds = cmd.slashCommand.options?.filter(
                (opt) => opt.type === ApplicationCommandOptionType.Subcommand,
            );
            const subCmdsString = subCmds?.map((s) => s.name).join(", ");
            return `\`/${cmd.name}\`\n ❯ **${guild.getT("core:HELP.CMD_DESC")}**: ${guild.getT(cmd.description)}\n ${!subCmds?.length ? "\n" :
                `❯ **${guild.getT("core:HELP.CMD_SUBCOMMANDS")} [${subCmds?.length}]**: ${subCmdsString}\n`
                }`;
        });
        arrSplitted.push(toAdd);
    }

    arrSplitted.forEach((item, index) => {
        arrEmbeds.push(EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${pluginName.toUpperCase()}` })
            .setDescription(item.join("\n"))
            .setFooter({
                text: guild.getT("core:HELP.PLUGIN_EMBED_FOOTER", {
                    page: index + 1,
                    pages: arrSplitted.length,
                    prefix: "/",
                }),
            }));
    });

    return arrEmbeds;
}

function getPrefixPluginCommandEmbed(guild, pluginName, prefix) {
    const commands = [
        ...guild.client.pluginManager.plugins.find((p) => p.name === pluginName).commands,
    ].filter((cmd) => cmd.command?.enabled);

    if (commands.length === 0) {
        return [EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${guild.getT(pluginName.toLowerCase() + ":TITLE")}` })
            .setDescription(guild.getT("core:HELP.EMPTY_CATEGORY"))];
    }

    const arrSplitted = [];
    const arrEmbeds = [];

    while (commands.length) {
        let toAdd = commands.splice(0, Math.min(CMDS_PER_PAGE, commands.length));
        toAdd = toAdd.map((cmd) => {
            const subCmds = cmd.command.subcommands;
            const subCmdsString = subCmds?.map((s) => s.trigger.split(" ")[0]).join(", ");
            return `\`${prefix}${cmd.name}\`\n ❯ **${guild.getT("core:HELP.CMD_DESC")}**: ${guild.getT(cmd.description)}\n ${!subCmds?.length ? "\n" :
                `❯ **${guild.getT("core:HELP.CMD_SUBCOMMANDS")} [${subCmds?.length}]**: ${subCmdsString}\n`
                }`;
        });
        arrSplitted.push(toAdd);
    }

    arrSplitted.forEach((item, index) => {
        arrEmbeds.push(EmbedUtils.embed()
            .setAuthor({ name: `Plugin ${guild.getT(pluginName.toLowerCase() + ":TITLE")}` })
            .setDescription(item.join("\n"))
            .setFooter({
                text: guild.getT("core:HELP.PLUGIN_EMBED_FOOTER", {
                    page: index + 1,
                    pages: arrSplitted.length,
                    prefix,
                }),
            }));
    });

    return arrEmbeds;
}