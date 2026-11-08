---
title: Divi 5 Loop Builder with AI: lists that fill themselves
description: How to have Claude, ChatGPT or Cursor build Divi 5 Loop Builder lists (posts, products, categories, paged archives) safely, and what is checked before saving.
date: 2026-11-08
keywords: divi 5 loop builder, divi 5 loop builder ai, divi 5 mcp, claude divi 5, dynamic posts divi 5
---

The **Loop Builder** is one of the most useful features in Divi 5. You design one card, switch a loop on, and Divi repeats that card once per post, product, category, user or menu item on your site. Add a post and it appears; no copy-pasting, no rebuilding.

It is also easy to get wrong. A loop is a set of settings hidden on a module, and a few wrong values make Divi fail the **whole page** for every visitor, while others quietly list the wrong things. That is exactly the kind of work an AI assistant should not do unchecked, so the free [AI Editor for Divi 5](/plugins/divi-5-ai-editor) (version 4.18.0 and later) teaches your assistant the Loop Builder and checks every loop before it is saved.

## What you can ask for

Once your assistant is connected (see [how to connect Claude](/guides/connect-claude-to-divi-5) or [Cursor](/guides/connect-cursor-to-divi-5)), plain requests work:

- "Add the three newest blog posts as cards to the home page, with a Read more button."
- "Make a News page that lists all posts, six per page, with Next and Previous links."
- "Show our categories as cards, most used first."
- "Put the four newest products on the shop landing page."

Four ready-made patterns cover these: the newest posts, all posts in pages, the site's categories and the newest WooCommerce products. They follow the design language and style kit of the page, so a loop looks like the rest of the site.

## What the AI Editor checks

Every loop goes through the same deterministic validator as the rest of the page. It refuses, with the exact setting to fix:

- settings that make Divi fail the whole page, such as a text value where Divi needs a list;
- settings that quietly switch the loop off, or make it list every post type, media files included;
- a dynamic-content token that is cut short, which Divi would print as raw text on the page.

You do not need to know the setting names. The assistant reads the refusal, corrects itself and tries again.

## See what a loop will show before it is saved

When your assistant saves, checks or previews a page that contains a loop, it also gets a short report for each loop: how many items match on **your** site and the first few titles. It flags a post type, category, term ID or navigation list your site does not have. That matters because Divi does not complain about a wrong ID. An unknown post type makes the loop list every post type, and a filter on a term that does not exist is ignored, so the list simply is not filtered. The report catches both before a visitor does.

The report is advice only. It never blocks a save, and it says plainly when a loop uses a filter it cannot count.

## Paging through a list

For a long list, the assistant adds Divi's **Post Navigation** module and points it at the loop. Visitors get Next and Previous links, and each loop pages on its own, so two lists on one page do not move together unless they share an ID (the report warns about that too).

## Good to know

- **Loops show what the site has.** Ask your assistant for IDs of categories or menus: the plugin can list them for it (`get_site_structure`), so it never has to guess.
- **A menu loop shows the menu in its own order** when it is set to descending, which is Divi's default. Setting it to ascending shows the menu backwards. This was verified on Divi 5.15.1.
- **Not covered yet:** loops that read an Advanced Custom Fields repeater from a real repeater field, loops inside Theme Builder templates, and Divi's Post Filter module. The plugin says so rather than guessing.

## Which assistant to use

Any assistant that can connect over MCP can build loops: Claude, Cursor, Windsurf and VS Code Copilot, and ChatGPT as a custom connector (see the [ChatGPT setup guide](/guides/connect-chatgpt-to-divi-5), which is not yet confirmed with a real ChatGPT account). The full picture of what connects and what each tool does is on the [Divi 5 MCP server page](/divi-5-mcp). The loop support is the same for all of them because it lives in the plugin on your site, not in the assistant.

## When Pro helps

The free plugin builds and checks loops on any page or Divi Project. If you want to carry a look across a whole site, the [Pro add-on](/pricing) can restyle pages to another design language in one previewed, undoable step, and build and launch a multi-page site with its menu, so a blog index with a loop becomes one page of a larger build. You never need Pro to use loops.

## Undo, always

Like every change made through the plugin, a page edit with a loop is checked first, new pages are saved as drafts, and the previous version of each page is kept so you can restore it from the plugin dashboard.

Ready to try it? [Get the free plugin](/plugins/divi-5-ai-editor), connect your assistant, and ask for your first list.
