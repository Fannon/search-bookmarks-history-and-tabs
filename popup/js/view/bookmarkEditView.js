
//////////////////////////////////////////
// BOOKMARK EDITING                     //
//////////////////////////////////////////

export function editBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find(
    (el) => el.originalId === bookmarkId
  );
  const tags = Object.keys(getUniqueTags()).sort();
  console.debug("Editing bookmark " + bookmarkId, bookmark);
  if (bookmark) {
    document.getElementById("edit-bookmark").style = "";
    document.getElementById("bookmark-title").value = bookmark.title;
    if (!ext.tagify) {
      ext.tagify = new Tagify(document.getElementById("bookmark-tags"), {
        whitelist: tags,
        trim: true,
        transformTag: transformTag,
        skipInvalid: false,
        editTags: {
          clicks: 1,
          keepInvalid: false,
        },
        dropdown: {
          position: "all",
          enabled: 0,
          maxItems: 12,
          closeOnSelect: false,
        },
      });
    } else {
      // If tagify was already initialized: 
      // reset current and available tags to new state
      ext.tagify.removeAllTags()
      ext.tagify.whitelist = tags
    }

    const currentTags = bookmark.tags
      .split("#")
      .map((el) => el.trim())
      .filter((el) => el);
    ext.tagify.addTags(currentTags);

    document.getElementById("edit-bookmark-save").href =
      "#update-bookmark/" + bookmarkId;
  } else {
    console.warn(
      `Tried to edit bookmark id="${bookmarkId}", but coult not find it in searchData.`
    );
  }

  function transformTag(tagData) {
    if (tagData.value.includes("#")) {
      tagData.value = tagData.value.split("#").join("");
    }
  }
}

export function updateBookmark(bookmarkId) {
  const bookmark = ext.model.bookmarks.find(el => el.originalId === bookmarkId);
  const titleInput = document.getElementById("bookmark-title").value.trim();
  const tagsInput = "#" + ext.tagify.value.map((el) => el.value.trim()).join(" #");

  // Update search data model of bookmark
  bookmark.title = titleInput;
  bookmark.tags = tagsInput;

  console.debug(
    `Update bookmark with ID ${bookmarkId}: "${titleInput} ${tagsInput}"`
  );

  if (browserApi.bookmarks) {
    browserApi.bookmarks.update(bookmarkId, {
      title: `${titleInput} ${tagsInput}`,
    });
  } else {
    console.warn(
      `No browser bookmarks API found. Bookmark update will not persist.`
    );
  }

  // Start search again to update the search index and the UI with new bookmark model
  window.location.href = "#";
}
