const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags
} = require("discord.js");

const { Client } = require("nekos-best.js");
const nekosBest = new Client();

/**
 * @type {import("strange-sdk").CommandType}
 */
module.exports = {
  name: "kiss",
  description: "Anime-style kiss reaction!",
  enabled: true,
  cooldown: 3,
  command: {
    enabled: true,
  },
  slashCommand: {
    enabled: false,
  },

  async messageRun({ message, args }) {
    const target = message.mentions.users.first();
    const extraText = args.slice(1).join(" ");

    if (!target) {
      return message.reply("Please mention someone to kiss!");
    }

    if (target.id === message.author.id) {
      return message.reply("You can't kiss yourself... but here's a virtual one! 😅");
    }

    try {
      const { results } = await nekosBest.fetch("kiss", 1);
      const gifUrl = results[0]?.url;
      const gifSource = results[0]?.anime_name;

      const attachment = new AttachmentBuilder(gifUrl, { name: "kiss.gif" });

      const textParts = [
        `**${message.author.username}** kisss **${target.username}**`,
        extraText ? `💬 *${extraText}*` : null,
        gifSource ? `📺 *Anime source: ${gifSource}*` : null,
      ].filter(Boolean);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("kiss_back_${message.id}")
          .setLabel("Kiss Back")
          .setStyle(ButtonStyle.Secondary)
      );

      const sentMessage = await message.channel.send({
        content: textParts.join("\n"),
        files: [attachment],
        components: [row],
      });

      const collector = sentMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      collector.on("collect", async (btn) => {
        if (btn.user.id !== target.id) {
          return btn.reply({
            content: "❌ Only the person who was mentioned can use this button.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await btn.deferUpdate();

        try {
          const { results } = await nekosBest.fetch("kiss", 1);
          const backGif = new AttachmentBuilder(results[0].url, { name: "kiss-back.gif" });

          const backText = `**${target.username}** kisss **${message.author.username}** back!\n📺 *Anime source: ${results[0].anime_name}*`;

          await message.channel.send({
            content: backText,
            files: [backGif],
            reply: { messageReference: sentMessage.id },
          });

          await sentMessage.edit({
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("kiss_back_${message.id}")
                  .setLabel("Kiss Back")
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              )
            ]
          });

          collector.stop();
        } catch (err) {
          console.error("[kiss-back] nekos-best API error:", err);
          return btn.followUp({
            content: "❌ Couldn't fetch a kiss back gif. Try again later.",
            flags: MessageFlags.Ephemeral,
          });
        }
      });

      collector.on("end", async () => {
        if (!sentMessage.deleted) {
          await sentMessage.edit({
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("kiss_back_${message.id}")
                  .setLabel("Kiss Back")
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              )
            ]
          });
        }
      });

    } catch (err) {
      console.error("[kiss] nekos-best API error:", err);
      return message.reply("❌ Couldn't fetch a kiss gif. Please try again later.");
    }
  },
};
