/**
 * Ghost Monetization Engine — DM Templates
 * Pattern-interrupt cold outreach scripts
 */

const DM_TEMPLATES = {
  // Initial cold outreach — pattern interrupt
  cold: {
    tiktok: [
      {
        template: "Just stalked your TikTok — solid traction, engaged comments, but I noticed you don't have a link in your bio. You already have the attention. What's the monetization setup looking like?",
        useWhen: "Creator has 20K+ followers, posts consistently, no link in bio or weak link"
      },
      {
        template: "Quick question — you're getting good engagement on your content. Are you actually monetizing that audience yet, or still figuring it out?",
        useWhen: "Creator has clear engagement, posts regularly, selling nothing"
      },
      {
        template: "Hey — your content is getting solid traction. Genuine question: do you have anything set up to actually capture that attention? Or still in 'figuring it out' mode?",
        useWhen: "General outreach for active creator with no visible offer"
      }
    ],
    linkedin: [
      {
        template: "Genuine question — your posts are getting good engagement. Do you have an offer or product built out, or are you still building in public?",
        useWhen: "LinkedIn builder with engaged posts, no offer visible"
      },
      {
        template: "Hey — love the content you're putting out. Question: is there a monetization component yet, or is that still on the roadmap?",
        useWhen: "Builder with authority but no clear offer"
      }
    ],
    youtube: [
      {
        template: "Just checked out your channel — solid growth on your subscriber count. Question: do you have a backend set up to actually monetize those views? Or is that still ahead?",
        useWhen: "YouTube channel with growth but no monetization visible"
      }
    ]
  },
  
  // Follow-up after no response
  followUp: {
    tiktok: [
      {
        template: "Hey — following up on my last message. Were you able to check out your monetization options yet?",
        useWhen: "3-5 days after initial DM, no response"
      },
      {
        template: "Quick bump — I know you probably get a lot of DMs. But if you're sitting on an audience and not monetizing it, that's money you're just leaving on the table. Worth at least a conversation.",
        useWhen: "5-7 days after initial, no response, want to add urgency"
      },
      {
        template: "Last msg from me on this — but genuinely, if you're posting daily and not capturing any of that attention into revenue, that's a solvable problem. Sometimes it just takes one conversation to see it differently.",
        useWhen: "7+ days after, final follow-up"
      }
    ],
    linkedin: [
      {
        template: "Hey — bumping this. If you're building in public without a monetization strategy, there's probably $5K-$20K/month sitting untapped. Worth a quick chat?",
        useWhen: "3-5 days after, LinkedIn"
      }
    ]
  },
  
  // After booking call / qualified lead
  qualified: {
    tiktok: [
      {
        template: "Great chat — excited to dig into your account. While you think about it, here's what I'd look at first: your content has proven viral potential, but there's no system capturing that attention into revenue. That's a fixable gap.",
        useWhen: "Post-discovery call, warm lead"
      },
      {
        template: "Alright — so the play is simple: we build you a monetization offer, create a funnel to capture leads, and add a payment link. You keep doing what you're doing. I'll handle the backend. Sound interesting?",
        useWhen: "Post-qualification, ready to close"
      }
    ],
    general: [
      {
        template: "The people who make money aren't necessarily the ones with the most followers. They're the ones who installed a money system. You already have the attention. We just need to point it at a revenue stream.",
        useWhen: "Closing approach, value reframe"
      }
    ]
  },
  
  // Objection handlers
  objections: {
    tooExpensive: [
      {
        template: "I hear you. But think about it this way — if the system I build you makes $5K/month, the ROI is there in the first month. This isn't a cost, it's an investment with a clear payback.",
        useWhen: "Price objection"
      },
      {
        template: "If cost is the concern, we can start smaller. Quick Flip is $500 — it's a test drive. If it works (and it does), we scale up to the Full Engine. No risk to start.",
        useWhen: "Price objection, offer downsell"
      }
    ],
    needToThink: [
      {
        template: "Totally fair. But here's the reality: every day you wait is another day of leaving money on the table. 30 days from now, you'll either have a monetization system or you'll still be in the same spot. Worth acting on.",
        useWhen: "Delay objection"
      }
    ],
    notReady: [
      {
        template: "I get it. But here's my honest take: 'not ready' usually means 'scared to mess it up' or 'don't know where to start.' That's literally what I solve. You bring the audience, I build the system.",
        useWhen: "Readiness objection"
      }
    ]
  }
};

/**
 * Generate a random template from a category
 */
function getTemplate(category, platform = "tiktok") {
  const templates = DM_TEMPLATES[category]?.[platform] || DM_TEMPLATES[category]?.general || [];
  if (templates.length === 0) return null;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Personalize a template with lead data
 */
function personalize(template, lead) {
  let text = template;
  
  if (lead.first_name) {
    text = text.replace(/Hey —/g, `Hey ${lead.first_name} —`);
    text = text.replace(/Hey,/g, `Hey ${lead.first_name},`);
  }
  
  if (lead.followers_count) {
    const formatted = lead.followers_count >= 1000 
      ? `${(lead.followers_count/1000).toFixed(0)}K` 
      : lead.followers_count;
    text = text.replace(/(\d+)K followers/g, `${formatted} followers`);
  }
  
  if (lead.engagement_rate) {
    text = text.replace(/solid engagement/g, `${lead.engagement_rate}% engagement`);
  }
  
  return text;
}

/**
 * Get all templates for a category
 */
function listTemplates(category, platform) {
  const templates = DM_TEMPLATES[category]?.[platform] || DM_TEMPLATES[category]?.general || [];
  return templates;
}

module.exports = { DM_TEMPLATES, getTemplate, personalize, listTemplates };
