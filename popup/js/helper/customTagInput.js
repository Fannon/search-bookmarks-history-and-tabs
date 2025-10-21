/**
 * @file Lightweight custom tag input component with autocomplete.
 *
 * A custom tag input component that provides:
 * - Tag creation/editing/removal
 * - Autocomplete dropdown with keyboard navigation
 * - Tag validation and transformation
 * - Clean API for managing tags
 *
 * Size: ~14 KB unminified
 */

/**
 * CustomTagInput - Lightweight tag input with autocomplete
 */
export class CustomTagInput {
  /**
   * Initialize the tag input on a textarea element.
   *
   * @param {HTMLTextAreaElement} textarea - The textarea element to replace
   * @param {Object} options - Configuration options
   * @param {Array<string>} options.whitelist - Available tags for autocomplete
   * @param {boolean} options.trim - Auto-trim tag values (default: true)
   * @param {Function} options.transformTag - Transform tag before adding
   * @param {boolean} options.skipInvalid - Skip invalid tags (default: false)
   * @param {Object} options.editTags - Edit configuration
   * @param {Object} options.dropdown - Dropdown configuration
   */
  constructor(textarea, options = {}) {
    this.textarea = textarea
    this.options = {
      whitelist: options.whitelist || [],
      trim: options.trim !== false,
      transformTag: options.transformTag || null,
      skipInvalid: options.skipInvalid || false,
      editTags: options.editTags || { clicks: 1, keepInvalid: false },
      dropdown: options.dropdown || { position: 'all', enabled: 0, maxItems: 12, closeOnSelect: false },
    }

    this.tags = []
    this.container = null
    this.input = null
    this.dropdown = null
    this.selectedIndex = -1

    this._init()
  }

  /**
   * Initialize the tag input UI.
   * @private
   */
  _init() {
    // Create container
    this.container = document.createElement('div')
    this.container.className = 'tag-input'
    this.container.setAttribute('role', 'application')
    this.container.setAttribute('aria-label', 'Tag input')

    // Create tags container
    this.tagsContainer = document.createElement('div')
    this.tagsContainer.className = 'tag-input__list'

    // Create input field
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.className = 'tag-input__field'
    this.input.placeholder = 'Type to add tags...'
    this.input.setAttribute('aria-autocomplete', 'list')

    // Create dropdown
    this.dropdown = document.createElement('div')
    this.dropdown.className = 'tag-input__dropdown'
    this.dropdown.style.display = 'none'
    this.dropdown.setAttribute('role', 'listbox')

    const dropdownWrapper = document.createElement('div')
    dropdownWrapper.className = 'tag-input__dropdown-wrapper'
    dropdownWrapper.appendChild(this.dropdown)

    // Assemble structure
    this.tagsContainer.appendChild(this.input)
    this.container.appendChild(this.tagsContainer)
    this.container.appendChild(dropdownWrapper)

    // Replace textarea with container
    this.textarea.style.display = 'none'
    this.textarea.parentNode.insertBefore(this.container, this.textarea)

    // Event listeners
    this._setupEventListeners()
  }

  /**
   * Setup event listeners for user interaction.
   * @private
   */
  _setupEventListeners() {
    // Input events
    this.input.addEventListener('input', this._handleInput.bind(this))
    this.input.addEventListener('keydown', this._handleKeydown.bind(this))
    this.input.addEventListener('blur', this._handleBlur.bind(this))

    // Container click to focus input
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container || e.target === this.tagsContainer) {
        this.input.focus()
      }
    })
  }

  /**
   * Handle input changes and show autocomplete.
   * @private
   */
  _handleInput() {
    const value = this.input.value.trim()

    if (value.length >= this.options.dropdown.enabled) {
      this._showDropdown(value)
    } else {
      this._hideDropdown()
    }
  }

  /**
   * Handle keyboard navigation and tag creation.
   * @private
   */
  _handleKeydown(e) {
    const value = this.input.value.trim()

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (this.selectedIndex >= 0 && this.dropdown.style.display !== 'none') {
          // Select from dropdown
          const items = this.dropdown.querySelectorAll('.tag-input__dropdown-item')
          const selectedItem = items[this.selectedIndex]
          if (selectedItem) {
            this._addTag(selectedItem.textContent)
            this.input.value = ''
            if (this.options.dropdown.closeOnSelect) {
              this._hideDropdown()
            } else {
              this._showDropdown('')
            }
          }
        } else if (value) {
          // Add tag from input
          this._addTag(value)
          this.input.value = ''
          this._hideDropdown()
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (this.dropdown.style.display !== 'none') {
          this._navigateDropdown(1)
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (this.dropdown.style.display !== 'none') {
          this._navigateDropdown(-1)
        }
        break

      case 'Escape':
        e.preventDefault()
        this._hideDropdown()
        this.input.value = ''
        break

      case 'Backspace':
        if (!value && this.tags.length > 0) {
          // Remove last tag if input is empty
          this._removeTag(this.tags.length - 1)
        }
        break

      case ',':
      case ';':
        // Create tag on comma/semicolon
        e.preventDefault()
        if (value) {
          this._addTag(value)
          this.input.value = ''
          this._hideDropdown()
        }
        break
    }
  }

  /**
   * Handle input blur event.
   * @private
   */
  _handleBlur() {
    // Delay to allow dropdown clicks to register
    setTimeout(() => {
      this._hideDropdown()
    }, 200)
  }

  /**
   * Show autocomplete dropdown with filtered suggestions.
   * @private
   */
  _showDropdown(query) {
    const filtered = this._filterWhitelist(query)
    this.dropdown.innerHTML = ''
    this.selectedIndex = -1

    if (filtered.length === 0) {
      this._hideDropdown()
      return
    }

    const maxItems = Math.min(filtered.length, this.options.dropdown.maxItems)
    for (let i = 0; i < maxItems; i++) {
      const item = document.createElement('div')
      item.className = 'tag-input__dropdown-item'
      item.textContent = filtered[i]
      item.setAttribute('role', 'option')
      item.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this._addTag(filtered[i])
        this.input.value = ''
        if (this.options.dropdown.closeOnSelect) {
          this._hideDropdown()
        } else {
          this._showDropdown('')
        }
      })
      this.dropdown.appendChild(item)
    }

    this.dropdown.style.display = 'block'
  }

  /**
   * Hide autocomplete dropdown.
   * @private
   */
  _hideDropdown() {
    this.dropdown.style.display = 'none'
    this.selectedIndex = -1
  }

  /**
   * Navigate dropdown with arrow keys.
   * @private
   */
  _navigateDropdown(direction) {
    const items = this.dropdown.querySelectorAll('.tag-input__dropdown-item')
    if (items.length === 0) {
      this.selectedIndex = -1
      return
    }

    // Remove previous selection
    if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
      items[this.selectedIndex].classList.remove('tag-input__dropdown-item--active')
    }

    // Update index
    this.selectedIndex += direction
    if (this.selectedIndex < 0) {
      this.selectedIndex = items.length - 1
    } else if (this.selectedIndex >= items.length) {
      this.selectedIndex = 0
    }

    // Apply selection
    items[this.selectedIndex].classList.add('tag-input__dropdown-item--active')
    // scrollIntoView may not be available in test environments
    if (typeof items[this.selectedIndex].scrollIntoView === 'function') {
      items[this.selectedIndex].scrollIntoView({ block: 'nearest' })
    }
  }

  /**
   * Filter whitelist based on query and existing tags.
   * @private
   */
  _filterWhitelist(query) {
    const lowerQuery = query.toLowerCase()
    const existingTags = this.tags.map((t) => t.value.toLowerCase())

    return this.options.whitelist
      .filter((tag) => {
        const lowerTag = tag.toLowerCase()
        // Filter out existing tags and tags that don't match the query
        if (existingTags.includes(lowerTag)) return false
        if (lowerQuery && !lowerTag.includes(lowerQuery)) return false
        return true
      })
      .sort((a, b) => {
        if (!lowerQuery) return a.localeCompare(b)
        // Prioritize matches at start
        const aStarts = a.toLowerCase().startsWith(lowerQuery)
        const bStarts = b.toLowerCase().startsWith(lowerQuery)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        return a.localeCompare(b)
      })
  }

  /**
   * Add a new tag.
   * @private
   */
  _addTag(value) {
    if (this.options.trim) {
      value = value.trim()
    }

    if (!value) return

    // Transform tag if function provided
    const tagData = { value }
    if (this.options.transformTag) {
      this.options.transformTag(tagData)
      value = tagData.value
    }

    // Check for duplicates
    if (this.tags.some((t) => t.value.toLowerCase() === value.toLowerCase())) {
      return
    }

    this.tags.push({ value })
    this._renderTags()
  }

  /**
   * Remove a tag by index.
   * @private
   */
  _removeTag(index) {
    if (index >= 0 && index < this.tags.length) {
      this.tags.splice(index, 1)
      this._renderTags()
    }
  }

  /**
   * Render all tags in the UI.
   * @private
   */
  _renderTags() {
    // Clear existing tags (but keep input)
    const existingTags = this.tagsContainer.querySelectorAll('.tag-input__tag')
    existingTags.forEach((tag) => tag.remove())

    // Render each tag
    this.tags.forEach((tag, index) => {
      const tagEl = document.createElement('div')
      tagEl.className = 'tag-input__tag'
      tagEl.setAttribute('role', 'button')
      tagEl.setAttribute('aria-label', `Tag: ${tag.value}`)

      const tagContent = document.createElement('div')
      tagContent.textContent = tag.value

      // Edit on click if enabled
      if (this.options.editTags && this.options.editTags.clicks === 1) {
        tagContent.addEventListener('click', () => {
          this._editTag(index, tagEl)
        })
        tagContent.style.cursor = 'pointer'
      }

      const removeBtn = document.createElement('button')
      removeBtn.className = 'tag-input__remove'
      removeBtn.innerHTML = '&times;'
      removeBtn.setAttribute('aria-label', 'Remove tag')
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this._removeTag(index)
      })

      tagEl.appendChild(tagContent)
      tagEl.appendChild(removeBtn)
      this.tagsContainer.insertBefore(tagEl, this.input)
    })
  }

  /**
   * Edit a tag inline.
   * @private
   */
  _editTag(index, tagEl) {
    const tag = this.tags[index]
    const tagContent = tagEl.querySelector('div')

    const input = document.createElement('input')
    input.type = 'text'
    input.value = tag.value
    input.className = 'tag-input__edit'
    input.style.width = `${Math.max(50, tag.value.length * 8)}px`

    const saveEdit = () => {
      const newValue = this.options.trim ? input.value.trim() : input.value
      if (newValue && newValue !== tag.value) {
        // Transform if needed
        const tagData = { value: newValue }
        if (this.options.transformTag) {
          this.options.transformTag(tagData)
        }

        // Check for duplicates
        const isDuplicate = this.tags.some(
          (t, i) => i !== index && t.value.toLowerCase() === tagData.value.toLowerCase()
        )

        if (!isDuplicate) {
          this.tags[index].value = tagData.value
          this._renderTags()
        } else {
          // Revert
          this._renderTags()
        }
      } else if (!newValue || (this.options.editTags && !this.options.editTags.keepInvalid)) {
        // Remove if empty or invalid
        this._removeTag(index)
      } else {
        // Revert
        this._renderTags()
      }
    }

    input.addEventListener('blur', saveEdit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        saveEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this._renderTags()
      }
    })

    tagContent.replaceWith(input)
    input.focus()
    input.select()
  }

  // Public API methods

  /**
   * Remove all tags.
   */
  removeAllTags() {
    this.tags = []
    this._renderTags()
  }

  /**
   * Add multiple tags.
   *
   * @param {Array<string>} tags - Array of tag values to add
   */
  addTags(tags) {
    if (Array.isArray(tags)) {
      tags.forEach((tag) => this._addTag(tag))
    }
  }

  /**
   * Get current tag values.
   *
   * @returns {Array<{value: string}>} Array of tag objects
   */
  get value() {
    return this.tags.map((tag) => ({ value: tag.value }))
  }

  /**
   * Get/set whitelist for autocomplete.
   */
  get whitelist() {
    return this.options.whitelist
  }

  set whitelist(tags) {
    this.options.whitelist = tags || []
  }

  /**
   * Destroy the tag input and restore textarea.
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    if (this.textarea) {
      this.textarea.style.display = ''
    }
  }
}
