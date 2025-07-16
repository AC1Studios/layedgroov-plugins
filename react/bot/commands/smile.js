const {
  AttachmentBuilder,
  MessageFlags
} = require("discord.js");

const { Client } = require("nekos-best.js");
const nekosBest = new Client();

/**
 * @type {import("strange-sdk").CommandType}
 */
module.exports = {
  name: "smile",
  description: "Express smile in anime-style!",
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

    try {
      const { results } = await nekosBest.fetch("smile", 1);
      const gifUrl = results[0]?.url;
      const gifSource = results[0]?.anime_name;

      const attachment = new AttachmentBuilder(gifUrl, { name: "smile.gif" });

      const displayText = target
        ? `**${message.author.username}** smiles at **${target.username}**!`
        : `**${message.author.username}** smiles sweetly. 😊`;

      const textParts = [
        displayText,
        extraText ? `💬 *${extraText}*` : null,
        gifSource ? `📺 *Anime source: ${gifSource}*` : null,
      ].filter(Boolean);

      await message.channel.send({
        content: textParts.join("\n"),
        files: [attachment],
      });

    } catch (err) {
      console.error("[smile] nekos-best API error:", err);
      return message.reply("❌ Couldn't fetch a smile gif. Please try again later.");
    }
  },
};
