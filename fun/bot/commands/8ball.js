const answers = require("../../assets/8ball.json");
const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Message,
  CommandInteraction,
  CommandInteractionOptionResolver,
  ApplicationCommandOptionType,
} = require("discord.js");

module.exports = {
  name: "8ball",
  description: "Determine your destiny with the 8-ball.",
  cooldown: 5,
  category: "FUN",
  command: {
    enabled: true,
    aliases: ["8-ball", "eightball"],
  },
  slashCommand: {
    enabled: true,
    global: true, 
    options: [
      {
        name: "to-ask",
        description: "Ask LayEdGroov's magic 8ball a question.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  // Message-based command
  async messageRun({ message, args }) {
    if (!Array.isArray(args) || args.length === 0) {
      return message.reply({
        content: "🎱 Please ask a question to determine your destiny!",
      });
    }

    const question = args.join(" ");
    const answer = () => answers[Math.floor(Math.random() * answers.length)];

    const createEmbed = () =>
      new EmbedBuilder()
        .setColor("Random")
        .setAuthor({
          name: `${message.author.username} asks the Mystic Lay8-Ball...`,
          iconURL: message.author.displayAvatarURL(),
        })
        .setThumbnail(
          "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/8-Ball_Pool.svg/1024px-8-Ball_Pool.svg.png"
        )
        .addFields(
          { name: "❓ Question", value: `> ${question}` },
          { name: "🎱 Answer", value: `> **${answer()}**` }
        )
        .setFooter({
          text: "Layedgroov Powered Magic Lay8-Ball • Ask again anytime",
          iconURL:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/8-Ball_Pool.svg/1024px-8-Ball_Pool.svg.png",
        })
        .setTimestamp();

    // DM-safe: if not in a guild, just send embed
    if (!message.guild) {
      return message.reply({ embeds: [createEmbed()] });
    }

    // Guild version with button
    const button = new ButtonBuilder()
      .setCustomId("shake_again")
      .setLabel("🔁 Shake Again")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(button);

    const thinkingMsg = await message.reply({
      content: "🎱 Shaking the Lay8-ball...",
    });

    setTimeout(async () => {
      try {
        await thinkingMsg.edit({ content: null, embeds: [createEmbed()], components: [row] });
      } catch {}

      if (thinkingMsg.channel) {
        const collector = thinkingMsg.channel.createMessageComponentCollector({
          componentType: 2, // Button
          time: 15000,
        });

        collector.on("collect", async (btnInteraction) => {
          if (btnInteraction.user.id !== message.author.id) {
            return btnInteraction.reply({
              content: "Only the original asker can shake again!",
              ephemeral: true,
            });
          }

          try {
            await btnInteraction.update({ embeds: [createEmbed()], components: [row] });
          } catch {}
        });

        collector.on("end", () => {
          try {
            const disabledRow = new ActionRowBuilder().addComponents(
              button.setDisabled(true)
            );
            thinkingMsg.edit({ components: [disabledRow] }).catch(() => {});
          } catch {}
        });
      }
    }, 2000);
  },

  // Slash command
  async interactionRun({ interaction }) {
    const question = interaction.options.getString("to-ask");
    if (!question || question.length > 2800)
      return interaction.followUp({
        content:
          "😵‍💫 Your question is invalid or too long!\nTry asking something shorter.",
        ephemeral: true,
      });

    const answer = () => answers[Math.floor(Math.random() * answers.length)];

    const createEmbed = () =>
      new EmbedBuilder()
        .setColor("Random")
        .setAuthor({
          name: `${interaction.user.username} asks the Mystic Lay8-Ball...`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setThumbnail(
          "https://upload.wikimedia.org/wikipedia/commons/f/fd/8-Ball_Pool.svg/1024px-8-Ball_Pool.svg.png"
        )
        .addFields(
          { name: "❓ Question", value: `> ${question}` },
          { name: "🎱 Answer", value: `> **${answer()}**` }
        )
        .setFooter({
          text: "Layedgroov Powered Magic Lay8-Ball • Ask again anytime",
          iconURL:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/8-Ball_Pool.svg/1024px-8-Ball_Pool.svg.png",
        })
        .setTimestamp();

    // DM-safe: if not in a guild, just send embed
    if (!interaction.guild) {
      return interaction.followUp({ embeds: [createEmbed()] });
    }

    // Guild version with button
    const button = new ButtonBuilder()
      .setCustomId("shake_again")
      .setLabel("🔁 Shake Again")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(button);

    const replyMsg = await interaction.followUp({
      content: "🎱 Shaking the 8-ball...",
      fetchReply: true,
    });

    setTimeout(async () => {
      try {
        await replyMsg.edit({ content: null, embeds: [createEmbed()], components: [row] });
      } catch {}

      if (replyMsg.channel) {
        const collector = replyMsg.createMessageComponentCollector({
          componentType: 2,
          time: 15000,
        });

        collector.on("collect", async (btnInteraction) => {
          if (btnInteraction.user.id !== interaction.user.id)
            return btnInteraction.reply({
              content: "Only the original asker can shake again!",
              ephemeral: true,
            });

          try {
            await btnInteraction.update({ embeds: [createEmbed()], components: [row] });
          } catch {}
        });

        collector.on("end", () => {
          try {
            const disabledRow = new ActionRowBuilder().addComponents(button.setDisabled(true));
            replyMsg.edit({ components: [disabledRow] }).catch(() => {});
          } catch {}
        });
      }
    }, 2000);
  },
};
