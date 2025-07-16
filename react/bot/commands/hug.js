const { AttachmentBuilder } = require("discord.js");
const { Client } = require("nekos-best.js");
const nekosBest = new Client();

/**
 * @type {import("strange-sdk").CommandType}
 */
module.exports = {
  name: "hug",
  description: "Send someone a warm anime hug!",
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
      return message.reply("Please mention someone to hug!");
    }

    if (target.id === message.author.id) {
      return message.reply("You can't hug yourself... but here's a hug from me! 🤗");
    }

    try {
      const { results } = await nekosBest.fetch("hug", 1);
      const gifUrl = results[0]?.url;
      const gifSource = results[0]?.anime_name;

      const attachment = new AttachmentBuilder(gifUrl, { name: "hug.gif" });

      const textParts = [
        `**${message.author.username}** hugs **${target.username}** 🫂`,
        extraText ? `💬 *${extraText}*` : null,
        gifSource ? `📺 *Anime source: ${gifSource}*` : null,
      ].filter(Boolean);

      await message.channel.send({
        content: textParts.join("\n"),
        files: [attachment],
      });

    } catch (err) {
      console.error("[hug] nekos-best API error:", err);
      return message.reply("❌ Couldn't fetch a hug gif. Please try again later.");
    }
  },
};
