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

/**
 * Notify Discord when a tag is unmarked as complete (was a mistake).
 */
async function notifyTagIncomplete(tag, unmarkedBy) {
  const fields = [
    { name: 'Customer', value: tag.customer_name, inline: true },
    { name: 'Unmarked By', value: unmarkedBy, inline: true }
  ];

  if (tag.project_name) {
    fields.push({ name: 'Project', value: tag.project_name, inline: true });
  }

  await sendDiscordNotification({
    title: '⚠️ Tag Marked Incomplete',
    description: `**${tag.customer_name}**'s tag was marked back to incomplete — do NOT schedule yet.`,
    color: 0xd32f2f, // red
    fields,
    footer: 'Stock Manager'
  });
}

/**
 * Send a summary of all ready-to-schedule tags to Discord.
 */
async function notifyReadyList(tags) {
  if (!tags || tags.length === 0) {
    return { sent: false, reason: 'No complete tags to report' };
  }

  const lines = tags.map(tag => {
    const itemCount = tag.sku_items?.length || 0;
    const project = tag.project_name ? ` — ${tag.project_name}` : '';
    return `• **${tag.customer_name}**${project} (${itemCount} SKUs)`;
  });

  await sendDiscordNotification({
    title: `📋 Ready to Schedule (${tags.length} tag${tags.length === 1 ? '' : 's'})`,
    description: lines.join('\n'),
    color: 0x1976d2, // blue
    footer: 'Stock Manager'
  });

  return { sent: true, count: tags.length };
}

module.exports = { sendDiscordNotification, notifyTagComplete, notifyTagIncomplete, notifyReadyList };
