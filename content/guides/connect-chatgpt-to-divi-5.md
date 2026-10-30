---
title: How to Connect ChatGPT to Divi 5 (Custom MCP Connector)
description: Connect ChatGPT to your Divi 5 site as a custom MCP connector that signs in with your WordPress login. Steps, requirements and what is not confirmed yet.
date: 2026-10-29
keywords: chatgpt divi, chatgpt mcp connector wordpress, divi 5 chatgpt, chatgpt developer mode, custom gpt actions retired
---

OpenAI is retiring Custom GPTs. If you opened ChatGPT to use your Divi 5 site and were told to "create a plugin" instead, this is why: the Actions that older Custom GPTs used to call a website do not carry over to the new plugins. The replacement is a **custom connector**, which is simply an **MCP server** that ChatGPT signs in to. The [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin already is an MCP server (it is how Claude, Cursor and VS Code connect), and since version 4.16.0 it can also sign ChatGPT in. This guide shows the steps.

**One honest note first.** We built the sign-in to match OpenAI's published requirements for connectors, and we test it with a script that follows OpenAI's documented flow step by step. We have not yet been able to try it with a real ChatGPT account, because it needs a paid plan we do not have. Treat these steps as likely to work, not as proven. ChatGPT also renames its menus from time to time, so the labels below may differ a little. If you try it, please tell us what you see on the [plugin's support forum](https://wordpress.org/support/plugin/jhmg-ai-editor-for-divi-5/); a report from a real account is what lets us remove this note.

## What you need first

- Divi 5 (not Divi 4) on WordPress 6.0+ and PHP 8.1+.
- The free [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin (listed in WordPress as JHMG AI Editor for Divi 5), **version 4.16.0 or newer**, installed and active.
- Your site reachable over **public HTTPS**. ChatGPT calls your site from OpenAI's servers, not from your own computer, so `localhost`, a local development tool or an http-only staging site will not work. A real domain with a valid SSL certificate is required.
- A **paid ChatGPT plan with Developer mode**. Custom connectors are not available on every plan, and which plans have them is OpenAI's decision and can change. Check your plan in ChatGPT's settings.

## Step 1: Turn on the sign-in in WordPress

ChatGPT cannot send an API key, so it signs in with your WordPress login instead. In WP admin, open **AI Editor**, then the **Settings** tab, and find the card called **Claude on the web, ChatGPT, and other apps that sign in**. Click **Turn on sign-in for Claude and ChatGPT**. It is off until you do, and when it is off the plugin adds nothing to your site for it.

The same tab shows the **MCP address** of your site, something like `https://yoursite.com/wp-json/ai-editor-divi5/v1/mcp`. The ChatGPT panel in Settings has a Copy button for it.

## Step 2: Turn on Developer mode in ChatGPT

In ChatGPT, open **Settings** and look for **Developer mode**. It sits with the apps or connectors settings. This is the switch that lets you add your own connector.

## Step 3: Add the connector

Add a **custom connector** (an MCP server) and paste your site's MCP address from Step 1. Give it a name you will recognise, such as "My Divi 5 site".

## Step 4: Choose OAuth and allow it

When ChatGPT asks how to sign in, choose **OAuth**, and leave any client ID or client secret empty. The plugin registers ChatGPT by itself. Click **Connect**. Your site opens in a browser window; sign in to WordPress if asked, check that the page names ChatGPT (it shows the address it will send you back to), and press **Allow**.

You are signing in as yourself, so ChatGPT can only do what your WordPress user is allowed to do. If you can edit a page, it can edit that page, and nothing more.

## Step 5: Try it

Start a chat with the connector enabled and try low-stakes prompts first:

- **"List my Divi pages."** Confirms the connection works.
- **"Show me the layout of my Home page."** Read-only, safe to run anytime.
- **"Change the hero heading on Home to 'Built for speed, priced for growth.'"** The real test. Watch how ChatGPT reports the result.

If something fails, go back to the Settings tab and press **Test connection**. It checks that your site's MCP address answers and explains any problem in plain English.

## Why the validator still protects you

Whichever assistant you use, every layout change passes through the plugin's **deterministic validator** before anything is saved. An invalid change (a malformed attribute, impossible nesting, a missing required field against Divi 5's real module schema) is rejected with the exact violation message, and the assistant can use that to retry instead of leaving your page half-broken. New pages are always saved as **drafts**, and every page the assistant changes keeps its previous versions, so you can undo an edit from the plugin's Dashboard. The transport changes; the safety net does not. See [Divi 5 Design Tips](/guides/divi-5-design-tips) for the design conventions that sit on top of structural correctness.

## What the free plugin includes

Through the connector, ChatGPT gets every tool in the free plugin: list pages, read layouts, update existing ones, change a single piece of text without rebuilding the page, dry-run a change before saving it, create new pages as drafts, restore earlier versions, read your site structure, custom fields and WooCommerce products, turn supplied HTML into a Divi 5 layout, and use the style, landing-page, site and image guides and the library of section patterns. The plugin does not set your front page, edit menus, or save custom CSS or PHP. Details are on the [plugin page](/plugins/divi-5-ai-editor).

The free plugin is complete on its own. A separate Pro add-on adds more tools, such as whole-site build with one-step undo, Theme Builder editing, site-wide find and replace, a site audit, global colors, variables and presets, and WooCommerce product and price tools. Whether a given Pro tool works through the new connector in ChatGPT has not been confirmed yet. See the [pricing](/pricing).

## If you already built a Custom GPT

A Custom GPT that uses the plugin's Action (the OpenAPI route) keeps working until OpenAI retires Custom GPTs, which has been reported for 11 December 2026. The Action offers fewer tools than the connector, needs a paid plan and a public HTTPS address, and uses your API key as a Bearer token. The plugin still shows those steps under **Older route** in Settings. For anything new, use the connector above, because Actions do not carry over to OpenAI's new plugins.

## Troubleshooting

**"Could not reach your site."** Your site is not publicly reachable over HTTPS, or the address is wrong. Open the MCP address from a browser you are not logged into on another device: you should get an answer, not a timeout.

**The sign-in window does not open, or ChatGPT says it cannot register.** Check that you turned on the sign-in in Step 1. If your host or a security plugin blocks requests to `/.well-known/` or to `wp-json`, allow them; ChatGPT reads two small files there to find out how to sign in.

**The connector works, then stops asking you to sign in again.** Open Settings in WordPress and check the sign-in is still on, and that your WordPress user can still edit pages. Signing in follows your user, so a demoted or deleted user loses access at once.

**ChatGPT describes a change instead of making it.** Make sure the connector is enabled in that chat (it is chosen per conversation), and that your plan allows tools that change things in Developer mode. We have not been able to confirm how each plan treats this.

Ready to try it? [Get the free AI Editor for Divi 5](/plugins/divi-5-ai-editor), turn on the sign-in, and make your first validated edit.
