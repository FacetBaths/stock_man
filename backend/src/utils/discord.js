const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Send a Discord webhook notification.
 * Silently fails if DISCORD_WEBHOOK_URL is not configured.
 */
async function sendDiscordNotification({ title, description, color = 0x28a745, fields = [], footer }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('Discord webhook not configured (DISCORD_WEBHOOK_URL not set), skipping notification');
    return;
  }

  const embed = {
    title,
    description,
    color,
    fields,
    timestamp: new Date().toISOString()
  };

  if (footer) {
    embed.footer = { text: footer };
  }

  const payload = JSON.stringify({ embeds: [embed] });

  try {
    const url = new URL(webhookUrl);
    const lib = url.protocol === 'https:' ? https : http;

    await new Promise((resolve, reject) => {
      const req = lib.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Discord webhook returned ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    console.log(`✅ Discord notification sent: ${title}`);
  } catch (error) {
    // Don't let Discord failures break the app
    console.error('Discord webhook error (non-fatal):', error.message);
  }
}

/**
 * Notify Discord when a tag is marked as complete.
 */
async function notifyTagComplete(tag, markedBy) {
  const itemCount = tag.sku_items?.length || 0;
  const totalQty = tag.sku_items?.reduce((sum, item) => {
    return sum + (item.selected_instance_ids?.length || item.quantity || 0);
  }, 0) || 0;

  const fields = [
    { name: 'Customer', value: tag.customer_name, inline: true },
    { name: 'Items', value: `${itemCount} SKUs (${totalQty} units)`, inline: true },
    { name: 'Marked By', value: markedBy, inline: true }
  ];

  if (tag.project_name) {
    fields.push({ name: 'Project', value: tag.project_name, inline: true });
  }

  if (tag.due_date) {
    fields.push({ name: 'Due Date', value: new Date(tag.due_date).toLocaleDateString(), inline: true });
  }

  await sendDiscordNotification({
    title: '✅ Tag Marked Complete',
    description: `**${tag.customer_name}**'s tag is complete and ready to schedule.`,
    color: 0x28a745, // green
    fields,
    footer: 'Stock Manager'
  });
}

module.exports = { sendDiscordNotification, notifyTagComplete };
