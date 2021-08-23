//////////////////////////////////////////
// SEARCH VIEW                          //
//////////////////////////////////////////

import { initExtension } from "../initSearch.js"
import { getUserOptions, setUserOptions } from "../model/options.js"

/**
 * Render the search results in UI as result items
 */
export function renderSearchResults(result) {
  result = result || ext.model.result

  performance.mark("render-start")

  ext.model.mouseHoverEnabled = false
  const resultListItems = []

  for (let i = 0; i < result.length; i++) {
    const resultEntry = result[i]

    if (!resultEntry) {
      continue
    }

    // Create result list item (li)
    const resultListItem = document.createElement("li")
    resultListItem.classList.add(resultEntry.type)
    resultListItem.setAttribute("x-open-url", resultEntry.originalUrl)
    resultListItem.setAttribute("x-index", i)
    resultListItem.setAttribute("x-original-id", resultEntry.originalId)

    // Create edit button / image
    if (resultEntry.type === "bookmark") {
      const editImg = document.createElement("img")
      editImg.classList.add("edit-button")
      editImg.src = "../images/edit.svg"
      resultListItem.appendChild(editImg)
    }

    // Create title div
    const titleDiv = document.createElement("div")
    titleDiv.classList.add("title")

    if (ext.opts.general.highlight) {
      const content = resultEntry.titleHighlighted || resultEntry.title || resultEntry.urlHighlighted || resultEntry.url
      if (content.includes("<mark>")) {
        titleDiv.innerHTML = content + " "
      } else {
        titleDiv.innerText = content + " "
      }
    } else {
      titleDiv.innerText = resultEntry.title | (resultEntry.url + " ")
    }
    if (ext.opts.general.tags && resultEntry.tags) {
      const tags = document.createElement("span")
      tags.title = "Bookmark Tags"
      tags.classList.add("badge", "tags")
      if (ext.opts.general.highlight && resultEntry.tagsHighlighted && resultEntry.tagsHighlighted.includes("<mark>")) {
        tags.innerHTML = resultEntry.tagsHighlighted
      } else {
        tags.innerText = resultEntry.tags
      }
      titleDiv.appendChild(tags)
    }
    if (resultEntry.folder) {
      const folder = document.createElement("span")
      folder.title = "Bookmark Folder"
      folder.classList.add("badge", "folder")
      if (
        ext.opts.general.highlight &&
        resultEntry.folderHighlighted &&
        resultEntry.folderHighlighted.includes("<mark>")
      ) {
        folder.innerHTML = resultEntry.folderHighlighted
      } else {
        folder.innerText = resultEntry.folder
      }
      titleDiv.appendChild(folder)
    }
    if (ext.opts.general.lastVisit && resultEntry.lastVisit) {
      const lastVisited = document.createElement("span")
      lastVisited.title = "Last Visited"
      lastVisited.classList.add("badge", "last-visited")
      lastVisited.innerText = "-" + resultEntry.lastVisit
      titleDiv.appendChild(lastVisited)
    }
    if (ext.opts.general.visitCounter && resultEntry.visitCount) {
      const visitCounter = document.createElement("span")
      visitCounter.title = "Visited Counter"
      visitCounter.classList.add("badge", "visit-counter")
      visitCounter.innerText = resultEntry.visitCount
      titleDiv.appendChild(visitCounter)
    }
    if (ext.opts.general.dateAdded && resultEntry.dateAdded) {
      const dateAdded = document.createElement("span")
      dateAdded.title = "Date Added"
      dateAdded.classList.add("badge", "date-added")
      dateAdded.innerText = new Date(resultEntry.dateAdded).toISOString().split("T")[0]
      titleDiv.appendChild(dateAdded)
    }
    if (ext.opts.general.score && resultEntry.score) {
      const score = document.createElement("span")
      score.title = "Score"
      score.classList.add("badge", "score")
      score.innerText = Math.round(resultEntry.score)
      titleDiv.appendChild(score)
    }

    // Create URL div
    const urlDiv = document.createElement("div")
    urlDiv.classList.add("url")
    if (ext.opts.general.highlight && resultEntry.urlHighlighted && resultEntry.urlHighlighted.includes("<mark>")) {
      urlDiv.innerHTML = resultEntry.urlHighlighted
    } else {
      urlDiv.innerText = resultEntry.url
    }

    // Append everything together :)
    resultListItem.appendChild(titleDiv)
    resultListItem.appendChild(urlDiv)
    resultListItem.addEventListener("mouseenter", hoverResultItem)
    resultListItem.addEventListener("mouseup", openResultItem)
    resultListItems.push(resultListItem)
  }

  if (ext.opts.general.highlight) {
    // Use mark.js to highlight search results, if we don't have already done so via fuse.js
    // This applies to flexsearch and taxonomy search results
    if (
      ext.opts.search.approach === "precise" ||
      ext.model.searchMode === "tags" ||
      ext.model.searchMode === "folders"
    ) {
      const markInstance = new Mark(resultListItems)
      markInstance.mark(ext.dom.searchInput.value)
    }
  }

  // Replace current results with new results
  ext.dom.resultList.replaceChildren(...resultListItems)

  // mark first result item as selected
  selectListItem(0)

  performance.mark("render-end")
  performance.measure("Render DOM", "render-start", "render-end")
  const renderPerformance = performance.getEntriesByType("measure")
  console.debug("Render Performance: " + renderPerformance[0].duration + "ms", renderPerformance)
  performance.clearMeasures()
}

//////////////////////////////////////////
// SEARCH VIEW NAVIGATION               //
//////////////////////////////////////////

/**
 * General key listener that detects keyboard navigation
 * -> Arrow up, Arrow Down, Enter
 */
export function navigationKeyListener(event) {
  if (event.key === "ArrowUp" && ext.model.currentItem > 0) {
    ext.model.currentItem--
    selectListItem(ext.model.currentItem, true)
  } else if (event.key === "ArrowDown" && ext.model.currentItem < ext.model.result.length - 1) {
    ext.model.currentItem++
    selectListItem(ext.model.currentItem, true)
  } else if (event.key === "Enter" && ext.model.result.length > 0) {
    // Enter selects selected search result -> only when in search mode
    if (window.location.hash.startsWith("#search/")) {
      openResultItem()
    }
  } else if (event.key === "Escape") {
    window.location.hash = "#search/"
    ext.dom.searchInput.focus()
  }
}

/**
 * Marks the list item with a specific index as selected
 */
export function selectListItem(index, scroll = false) {
  const currentSelection = document.getElementById("selected-result")
  if (currentSelection) {
    currentSelection.id = ""
  }
  if (ext.dom.resultList.children[index]) {
    ext.dom.resultList.children[index].id = "selected-result"

    if (scroll) {
      ext.dom.resultList.children[index].scrollIntoView({
        behavior: "auto",
        block: "nearest",
      })
    }
  }
  ext.model.currentItem = index
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
export function hoverResultItem(event) {
  const target = event.target ? event.target : event.srcElement
  const index = target.getAttribute("x-index")

  // Workaround to avoid that we get a mouse hover event
  // just by rendering the results "below" the pointer
  if (!ext.model.mouseHoverEnabled) {
    ext.model.mouseHoverEnabled = true
    return
  }

  if (index) {
    selectListItem(index)
  } else {
    console.warn("Could not hover result item", target, event)
  }
}

/**
 * When clicked on a list-item, we want to navigate like pressing "Enter"
 */
export function openResultItem(event) {
  const resultEntry = document.getElementById("selected-result")
  const url = resultEntry.getAttribute("x-open-url")

  if (event) {
    event.stopPropagation()
    const target = event.target ? event.target : event.srcElement

    // If the event is a click event on the edit image:
    // Do not go to the URL itself, but to the internal edit bookmark url
    if (target && target.src) {
      window.location = "#edit-bookmark/" + resultEntry.getAttribute("x-original-id")
      return
    }
  }

  // Else: Navigate to selected tab or link. Prefer browser tab API if available
  const foundTab = ext.model.tabs.find((el) => {
    return el.originalUrl === url
  })
  if (foundTab && ext.browserApi.tabs.highlight) {
    console.debug("Found tab, setting it active", foundTab)
    ext.browserApi.tabs.update(foundTab.originalId, {
      active: true,
    })
    window.close()
  } else if (ext.browserApi.tabs) {
    ext.browserApi.tabs.create({
      active: true,
      url: url,
    })
    window.close()
  } else {
    window.open(url, "_newtab")
  }
}

/**
 * Toggle the search approach between fuzzy and precise
 */
export async function toggleSearchApproach() {
  const userOptions = await getUserOptions()

  if (ext.opts.search.approach === "fuzzy") {
    ext.opts.search.approach = "precise"
  } else {
    ext.opts.search.approach = "fuzzy"
  }

  if (userOptions.search) {
    userOptions.search.approach = ext.opts.search.approach
  } else {
    userOptions.search = { approach: ext.opts.search.approach }
  }

  // Update user options
  await setUserOptions(userOptions)
  // Init extension again
  await initExtension()
}

/**
 * Toggles the text and class of the search aproach button
 */
export function updateSearchApproachToggle() {
  if (ext.opts.search.approach === "fuzzy") {
    ext.dom.searchApproachToggle.innerText = "FUZZY"
    ext.dom.searchApproachToggle.classList = "fuzzy"
  } else if (ext.opts.search.approach === "precise") {
    ext.dom.searchApproachToggle.innerText = "PRECISE"
    ext.dom.searchApproachToggle.classList = "precise"
  }
}
