/* All Credit to beej.us - https://beej.us/blog/data/mastodon-comments/ */

(function () {
  let view_button_state = "ready";
  let view_button_text;

  const qs = (s) => document.querySelector(s);
  const mastodon_server_domain = "fosstodon.org";

  /*
   * Return true if the record is blacklisted
   */
  function blacklisted(rec) {
    return (
      BBB_MASTODON_COMMENTS_BLACKLIST.has(rec.id) ||
      BBB_MASTODON_COMMENTS_BLACKLIST.has(rec.account.id) ||
      BBB_MASTODON_COMMENTS_BLACKLIST.has(rec.account.acct)
    );
  }

  /*
   * Handle the show-spoilers button
   */
  function on_sensitive_button_click(ev) {
    const button = ev.currentTarget;
    let content_outer = button;

    while (
      content_outer &&
      !content_outer.classList.contains("mast-comment-content-outer")
    )
      content_outer = content_outer.parentElement;

    if (!content_outer) throw "can't find mast-comment-content-outer";

    const content_div = content_outer.querySelector(".mast-comment-content");

    const currently_hidden = content_div.classList.contains("hidden");

    if (currently_hidden) {
      button.textContent = "Show Less";
      content_div.classList.remove("hidden");
    } else {
      button.textContent = "Show More";
      content_div.classList.add("hidden");
    }
  }

  /*
   * Find all the show-spoilers buttons and add a click handler
   */
  function add_sensitive_button_event_listeners() {
    const container = qs("#comments-container");

    const buttons = container.querySelectorAll(".mast-sensitive-button");

    for (b of buttons) {
      b.addEventListener("click", on_sensitive_button_click);
    }
  }

  /*
   * Handle non-standard emojis
   */
  function emoji_fix(rec) {
    const emoji_map = {};

    for (let erec of rec.emojis) {
      emoji_map[erec.shortcode] = {
        url: erec.url,
        static_url: erec.static_url,
      };
    }

    function replace_emoji(match, shortcode) {
      const url = emoji_map[shortcode]?.static_url;

      if (url) return `<img class="mast-comment-emoji" src="${url}">`;

      return `:${shortcode}:`;
    }

    const display_name = rec.account.display_name.replace(
      /:([A-Za-z0-9_+-]+):/g,
      replace_emoji,
    );
    const content = rec.content.replace(/:([A-Za-z0-9_+-]+):/g, replace_emoji);
    rec.content = content;
    rec.account.display_name = display_name;
  }

  /*
   * Normalize the content
   */
  function content_fix(rec) {
    if (rec.content.substring(0, 3) != "<p>") rec.content = "<p>" + rec.content;
  }

  /*
   * Return the HTML for any attachments
   */
  function get_attachment_html(rec) {
    let html = "",
      media_element;
    for (a of rec?.media_attachments) {
      switch (a.type) {
        case "image":
          media_element = `<img src="${a.url}" alt="${a.description}" lang="en" style="object-position: 50% 50%;">`;
          break;
        case "gifv":
          media_element = `<video class="mast-comment-attachments-gif" aria-label="${a.description}" lang="en" role="application" src="${a.url}" playsinline="" loop=""></video>`;
          break;
        case "video":
          media_element = `<video controls aria-label="${a.description}" src=${a.url}></video>`;
          break;
        case "audio":
          media_element = `<audio controls src=${a.url}></audio>`;
          break;
      }

      const line = `<div class="mast-comment-attachment">${media_element}</div>`;
      html += line;
    }

    if (html != "")
      html = `<div class="mast-comment-attachments"><p>${html}</div>`;

    return html;
  }

  /*
   * Play GIF‐videos when hovered
   */
  function add_gif_hover_listeners() {
    const container = qs("#comments-container");

    const gifs = container.querySelectorAll(".mast-comment-attachments-gif");
    if (!gifs) return;
    gifs.forEach((vid) => {
      vid.addEventListener("mouseenter", () => vid.play());
      vid.addEventListener("mouseleave", () => {
        vid.pause();
        vid.currentTime = 0;
      });
    });
  }

  /*
   * Handle the case where there are no comments
   */
  function empty_comments() {
    const container = qs("#comments-container");

    container.innerHTML = "<p>No comments yet. Click Reply to add one!";
  }

  /*
   * Get the HTML for the comment content. This includes the spoiler and
   * spoiler button, if present.
   */
  function get_content_html(rec) {
    let sensitive_html = "";
    let hide_content_css = "";

    if (rec.sensitive) {
      sensitive_html = `<div class="mast-comment-sensitive">
                <p>${rec.spoiler_text}
                <button class="mast-sensitive-button">Show More</button>
            </div>`;

      hide_content_css = " hidden";
    }

    return `<div class="mast-comment-content-outer">${sensitive_html}
            <div class="mast-comment-content${hide_content_css}">${rec.content}</div>
            <p class="mast-comment-id hidden">${rec.id}</p>
        </div>`;
  }

  function get_date_str(rec) {
    const local_date = new Date(rec.created_at);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    })
      .format(local_date)
      .replace(",", "");
  }

  /*
   * Main comment populator loop
   */
  function populate_comments(json) {
    const html_chunks = [];
    const descendants = json?.descendants;

    if (!descendants?.length) {
      empty_comments();
      return;
    }

    for (let rec of json.descendants) {
      if (blacklisted(rec)) continue;

      emoji_fix(rec);
      content_fix(rec);

      attachment_html = get_attachment_html(rec);
      content_html = get_content_html(rec);
      date_str = get_date_str(rec);

      const record_html =
        '<div class="mast-comment">' +
        '<div class="mast-comment-header">' +
        `<div class="mast-comment-avatar"><a href="${rec.account.url}"><img src="${rec.account.avatar}" alt="${rec.account.display_name} avatar"></a></div>` +
        '<div class="mast-comment-ident">' +
        `<div class="mast-comment-acct"><a href="${rec.account.url}">${rec.account.acct}</a></div>` +
        `<div class="mast-comment-display-name"><a href="${rec.account.url}">${rec.account.display_name}</a></div>` +
        "</div>" +
        `<div class="mast-comment-date"><a href="${rec.url}">${date_str}</a></div>` +
        "</div>" +
        content_html +
        attachment_html +
        "</div>";

      html_chunks.push(record_html);
    }

    const html = html_chunks.join("\n");

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const container = qs("#comments-container");

    container.innerHTML = "";
    container.append(...doc.body.children);

    add_gif_hover_listeners();
    add_sensitive_button_event_listeners();
  }

  /*
   * Handle the main "view comments" button state
   */
  function set_view_button_state(state) {
    const view_button = qs("#comments-view");

    view_button_state = "state";

    switch (state) {
      case "loading":
        view_button.innerHTML = "Loading...";
        break;
      case "ready":
        view_button.innerHTML = view_button_text;
        break;
      case "loaded":
        view_button.innerHTML = view_button_text;
        view_button.classList.add("dim");
        break;
    }
  }

  /*
   * Handle the "view comments" button being clicked. This loads the
   * comment JSON.
   */
  async function on_view_comments_clicked(ev) {
    ev.preventDefault();

    if (view_button_state != "ready") return;

    qs("#comments-cta").classList.add("hidden");

    set_view_button_state("loading");

    const comments_id = ev.target.dataset.commentsId;

    const url = `https://${mastodon_server_domain}/api/v1/statuses/${comments_id}/context`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }

      const json = await response.json();
      populate_comments(json);
      set_view_button_state("loaded");
    } catch (error) {
      set_view_button_state("ready");
      alert(`Error loading comments: ${error.message}`);
      console.error(error.message);
    }
  }

  

  /*
   * When the DOM loads
   */
  function on_dom_load() {
    const view_button = qs("#comments-view");
    if (view_button) {
      view_button.addEventListener("click", on_view_comments_clicked);
      view_button_text = view_button.innerHTML;
    }
  }

  /*
   * Main
   */
  window.addEventListener("DOMContentLoaded", on_dom_load);
})();
