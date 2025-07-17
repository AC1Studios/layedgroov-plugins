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
    options: [
      {
        name: "to-ask",
        description: "Ask LayEdGroov's magic 8ball a question.",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  /**
   * @param {{ message: Message, args: string[] }} param0
   */
  async messageRun({ message, args }) {
    if (!Array.isArray(args) || args.length === 0) {
      return message.reply({
        content: "🎱 Please ask a question to determine your destiny!",
      });
    }

    const question = args.join(" ");
    const answer = () =>
      answers[Math.floor(Math.random() * answers.length)];

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

    const button = new ButtonBuilder()
      .setCustomId("shake_again")
      .setLabel("🔁 Shake Again")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(button);

    const thinkingMsg = await message.reply({
      content: "🎱 Shaking the Lay8-ball...",
    });

    setTimeout(async () => {
      await thinkingMsg.edit({
        content: null,
        embeds: [createEmbed()],
        components: [row],
      });

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

        await btnInteraction.update({
          embeds: [createEmbed()],
          components: [row],
        });
      });

      collector.on("end", () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          button.setDisabled(true)
        );
        thinkingMsg.edit({ components: [disabledRow] });
      });
    }, 2000);
  },

  /**
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
async interactionRun({ interaction }) {
    const question = interaction.options.getString("to-ask");

    if (question.length > 2800) {
      return interaction.followUp({
        content:
          "😵‍💫 Your question is too long!\nTry asking something shorter.",
        ephemeral: true,
      });
    }

    const answer = () =>
      answers[Math.floor(Math.random() * answers.length)];

    const createEmbed = () =>
      new EmbedBuilder()
        .setColor("Random")
        .setAuthor({
          name: `${interaction.user.username} asks the Mystic Lay8-Ball...`,
          iconURL: interaction.user.displayAvatarURL(),
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

    const button = new ButtonBuilder()
      .setCustomId("shake_again")
      .setLabel("🔁 Shake Again")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.followUp({
      content: "🎱 Shaking the 8-ball...",
    });

    setTimeout(async () => {
      await interaction.editReply({
        content: null,
        embeds: [createEmbed()],
        components: [row],
      });

      const collector =
        interaction.channel.createMessageComponentCollector({
          componentType: 2,
          time: 15000,
        });

      collector.on("collect", async (btnInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) {
          return btnInteraction.reply({
            content: "Only the original asker can shake again!",
            ephemeral: true,
          });
        }

        await btnInteraction.update({
          embeds: [createEmbed()],
          components: [row],
        });
      });

      collector.on("end", () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          button.setDisabled(true)
        );
        interaction.editReply({ components: [disabledRow] });
      });
    }, 2000);
  },
};
