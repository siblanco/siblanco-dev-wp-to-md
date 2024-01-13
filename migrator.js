const TurndownService = require("turndown");
const fs = require("fs");

const BASE_URL = "https://blog.siblanco.dev/wp-json/wp/v2";

const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
});

turndownService.addRule("pre-code", {
  filter: function (node, options) {
    return node.nodeName === "PRE" && node.firstChild.nodeName === "CODE";
  },

  replacement: function (content, node, options) {
    if (node.firstElementChild.classList.length > 0) {
      return (
        "\n```" +
        (node.firstElementChild.classList.length > 0
          ? node.firstElementChild.classList[0].replace("language-", "").trim()
          : "") +
        "\n" +
        node.firstChild.textContent +
        "\n```\n"
      );
    } else {
      return "\n```\n" + node.firstChild.textContent + "\n```\n";
    }
  },
});

const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "");

async function getAllTags() {
  const response = await fetch(`${BASE_URL}/tags?per_page=100`);
  const tags = await response.json();
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
  }));
}

async function getAllPosts() {
  let i = 1;
  let allPosts = [];

  const response = await fetch(
    `${BASE_URL}/posts?page=${i}&per_page=100&order=desc&status=publish`,
  );
  const content = await response.json();
  allPosts = allPosts.concat(content);

  const totalPages = response.headers["x-wp-totalpages"];
  while (totalPages > i) {
    i++;
    const response = await fetch(
      `${BASE_URL}/posts?page=${i}&per_page=100&order=desc&status=publish`,
    );
    const content = await response.json();
    allPosts = allPosts.concat(content);
  }

  const blogTags = await getAllTags();

  return allPosts.map((post) => ({
    id: post.id,
    date: post.date,
    modified: post.modified,
    slug: post.slug,
    title: post.title.rendered,
    content: post.content.rendered,
    excerpt: post.excerpt.rendered,
    tags: blogTags.filter((tag) => post.tags.includes(tag.id)),
  }));
}

async function main() {
  const targetDir = "./posts";

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir);
  }

  const posts = await getAllPosts();
  for (const post of posts) {
    const { slug, title, content, tags, excerpt, date } = post;
    const filename = `${slug}.md`;
    fs.writeFileSync(
      `${targetDir}/${filename}`,
      `---
isDraft: false
title: "${title}"
description: "${stripHtml(excerpt).trim()}"
date: ${date}
tags: ${JSON.stringify(tags.map((tag) => tag.slug))}
---

${turndownService.turndown(content)}
`,
    );
  }
}

main();
