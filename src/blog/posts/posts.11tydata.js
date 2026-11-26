export default {
  layout: "layouts/post.njk",
  tags: [],
  eleventyComputed: {
    permalink: (data) => `/blog/${data.page.fileSlug}/`
  }
};
