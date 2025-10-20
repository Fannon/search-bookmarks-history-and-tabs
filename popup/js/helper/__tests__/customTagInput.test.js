/**
 * @file Unit tests for CustomTagInput component
 *
 * Tests the lightweight custom tag input implementation
 * that replaces the Tagify library.
 */

import { jest } from '@jest/globals'
import { CustomTagInput } from '../customTagInput.js'

describe('CustomTagInput', () => {
  let textarea
  let tagInput

  beforeEach(() => {
    document.body.innerHTML = '<textarea id="tags"></textarea>'
    textarea = document.getElementById('tags')
  })

  afterEach(() => {
    if (tagInput && tagInput.destroy) {
      tagInput.destroy()
    }
    document.body.innerHTML = ''
  })

  describe('Initialization', () => {
    it('should create tag input container and hide textarea', () => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta'],
      })

      expect(textarea.style.display).toBe('none')
      const container = textarea.previousSibling
      expect(container.className).toBe('tagify')
      expect(container.querySelector('.tagify__input')).not.toBeNull()
    })

    it('should initialize with default options', () => {
      tagInput = new CustomTagInput(textarea, {})

      expect(tagInput.options.trim).toBe(true)
      expect(tagInput.options.whitelist).toEqual([])
      expect(tagInput.options.skipInvalid).toBe(false)
    })

    it('should accept custom options', () => {
      const transformTag = jest.fn()
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta'],
        trim: false,
        transformTag,
        skipInvalid: true,
        editTags: { clicks: 2 },
        dropdown: { enabled: 1, maxItems: 5 },
      })

      expect(tagInput.options.whitelist).toEqual(['alpha', 'beta'])
      expect(tagInput.options.trim).toBe(false)
      expect(tagInput.options.transformTag).toBe(transformTag)
      expect(tagInput.options.skipInvalid).toBe(true)
      expect(tagInput.options.editTags.clicks).toBe(2)
      expect(tagInput.options.dropdown.maxItems).toBe(5)
    })
  })

  describe('Tag Management', () => {
    beforeEach(() => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta', 'gamma'],
      })
    })

    it('should add a single tag', () => {
      tagInput._addTag('alpha')

      expect(tagInput.tags).toHaveLength(1)
      expect(tagInput.tags[0].value).toBe('alpha')
      expect(tagInput.value).toEqual([{ value: 'alpha' }])
    })

    it('should add multiple tags', () => {
      tagInput.addTags(['alpha', 'beta'])

      expect(tagInput.tags).toHaveLength(2)
      expect(tagInput.value).toEqual([{ value: 'alpha' }, { value: 'beta' }])
    })

    it('should trim tag values when trim is enabled', () => {
      tagInput._addTag('  alpha  ')

      expect(tagInput.tags[0].value).toBe('alpha')
    })

    it('should not trim when trim is disabled', () => {
      tagInput = new CustomTagInput(textarea, {
        trim: false,
      })

      tagInput._addTag('  alpha  ')

      expect(tagInput.tags[0].value).toBe('  alpha  ')
    })

    it('should prevent duplicate tags (case-insensitive)', () => {
      tagInput._addTag('alpha')
      tagInput._addTag('Alpha')
      tagInput._addTag('ALPHA')

      expect(tagInput.tags).toHaveLength(1)
      expect(tagInput.tags[0].value).toBe('alpha')
    })

    it('should transform tags if transformTag function is provided', () => {
      const transformTag = jest.fn((tagData) => {
        tagData.value = tagData.value.replaceAll('#', '')
      })

      tagInput = new CustomTagInput(textarea, {
        transformTag,
      })

      tagInput._addTag('tag#with#hash')

      expect(transformTag).toHaveBeenCalled()
      expect(tagInput.tags[0].value).toBe('tagwithhash')
    })

    it('should remove a tag by index', () => {
      tagInput.addTags(['alpha', 'beta', 'gamma'])
      tagInput._removeTag(1)

      expect(tagInput.tags).toHaveLength(2)
      expect(tagInput.value).toEqual([{ value: 'alpha' }, { value: 'gamma' }])
    })

    it('should remove all tags', () => {
      tagInput.addTags(['alpha', 'beta', 'gamma'])
      tagInput.removeAllTags()

      expect(tagInput.tags).toHaveLength(0)
      expect(tagInput.value).toEqual([])
    })

    it('should not add empty tags', () => {
      tagInput._addTag('')
      tagInput._addTag('   ')

      expect(tagInput.tags).toHaveLength(0)
    })
  })

  describe('Whitelist', () => {
    beforeEach(() => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta', 'gamma'],
      })
    })

    it('should get whitelist', () => {
      expect(tagInput.whitelist).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('should set whitelist', () => {
      tagInput.whitelist = ['delta', 'epsilon']

      expect(tagInput.whitelist).toEqual(['delta', 'epsilon'])
    })

    it('should filter whitelist based on query', () => {
      const filtered = tagInput._filterWhitelist('a')

      // Should match tags containing 'a'
      expect(filtered).toContain('alpha')
      expect(filtered).toContain('gamma')
      // Beta contains 'a' as well
      expect(filtered).toContain('beta')
    })

    it('should exclude already added tags from whitelist', () => {
      tagInput._addTag('alpha')
      const filtered = tagInput._filterWhitelist('')

      expect(filtered).toEqual(['beta', 'gamma'])
      expect(filtered).not.toContain('alpha')
    })

    it('should prioritize matches at start of string', () => {
      tagInput.whitelist = ['beta', 'alphabet', 'alpha']
      const filtered = tagInput._filterWhitelist('alph')

      expect(filtered[0]).toBe('alpha')
      expect(filtered[1]).toBe('alphabet')
      expect(filtered).not.toContain('beta')
    })
  })

  describe('Dropdown', () => {
    beforeEach(() => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta', 'gamma', 'delta'],
        dropdown: {
          enabled: 0,
          maxItems: 3,
        },
      })
    })

    it('should show dropdown with filtered results', () => {
      tagInput._showDropdown('a')

      expect(tagInput.dropdown.style.display).toBe('block')
      const items = tagInput.dropdown.querySelectorAll('.tagify__dropdown__item')
      expect(items.length).toBeLessThanOrEqual(3)
    })

    it('should hide dropdown when no matches', () => {
      tagInput._showDropdown('xyz')

      expect(tagInput.dropdown.style.display).toBe('none')
    })

    it('should limit dropdown items to maxItems', () => {
      tagInput._showDropdown('')

      const items = tagInput.dropdown.querySelectorAll('.tagify__dropdown__item')
      expect(items.length).toBeLessThanOrEqual(3)
    })

    it('should hide dropdown', () => {
      tagInput._showDropdown('a')
      tagInput._hideDropdown()

      expect(tagInput.dropdown.style.display).toBe('none')
      expect(tagInput.selectedIndex).toBe(-1)
    })
  })

  describe('Keyboard Navigation', () => {
    beforeEach(() => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
        dropdown: { enabled: 0, maxItems: 5 },
      })
    })

    it('should navigate dropdown with arrow keys', () => {
      tagInput._showDropdown('a')
      let items = tagInput.dropdown.querySelectorAll('.tagify__dropdown__item')
      expect(items.length).toBeGreaterThan(0) // Ensure we have items

      tagInput._navigateDropdown(1)
      items = tagInput.dropdown.querySelectorAll('.tagify__dropdown__item')
      expect(tagInput.selectedIndex).toBe(0)
      expect(items[0].classList.contains('tagify__dropdown__item--active')).toBe(true)

      tagInput._navigateDropdown(1)
      expect(tagInput.selectedIndex).toBe(1)
    })

    it('should wrap around when navigating past the end', () => {
      tagInput._showDropdown('e')
      const items = tagInput.dropdown.querySelectorAll('.tagify__dropdown__item')
      expect(items.length).toBeGreaterThan(0) // Ensure we have items

      tagInput.selectedIndex = items.length - 1
      // Remove the active class from current item before navigating
      items[tagInput.selectedIndex].classList.add('tagify__dropdown__item--active')
      tagInput._navigateDropdown(1)

      expect(tagInput.selectedIndex).toBe(0)
    })

    it('should wrap around when navigating before the start', () => {
      tagInput._showDropdown('a')
      const items = tagInput.dropdown.querySelectorAll('.tagify__dropdown__item')
      expect(items.length).toBeGreaterThan(0) // Ensure we have items

      tagInput.selectedIndex = 0
      // Add active class to current item before navigating
      items[tagInput.selectedIndex].classList.add('tagify__dropdown__item--active')
      tagInput._navigateDropdown(-1)

      expect(tagInput.selectedIndex).toBe(items.length - 1)
    })
  })

  describe('Rendering', () => {
    beforeEach(() => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta'],
      })
    })

    it('should render tags in the UI', () => {
      tagInput.addTags(['alpha', 'beta'])

      const tagElements = tagInput.container.querySelectorAll('.tagify__tag')
      expect(tagElements).toHaveLength(2)
      expect(tagElements[0].textContent).toContain('alpha')
      expect(tagElements[1].textContent).toContain('beta')
    })

    it('should render remove buttons for each tag', () => {
      tagInput.addTags(['alpha'])

      const removeBtn = tagInput.container.querySelector('.tagify__tag-remove')
      expect(removeBtn).not.toBeNull()
      // jsdom renders &times; as ×
      expect(removeBtn.innerHTML).toBe('×')
    })

    it('should re-render when tags are updated', () => {
      tagInput.addTags(['alpha', 'beta'])
      let tagElements = tagInput.container.querySelectorAll('.tagify__tag')
      expect(tagElements).toHaveLength(2)

      tagInput._removeTag(0)
      tagElements = tagInput.container.querySelectorAll('.tagify__tag')
      expect(tagElements).toHaveLength(1)
      expect(tagElements[0].textContent).toContain('beta')
    })
  })

  describe('Destroy', () => {
    it('should destroy the component and restore textarea', () => {
      tagInput = new CustomTagInput(textarea, {})
      const container = textarea.previousSibling

      tagInput.destroy()

      expect(document.body.contains(container)).toBe(false)
      expect(textarea.style.display).toBe('')
    })
  })

  describe('Value getter', () => {
    beforeEach(() => {
      tagInput = new CustomTagInput(textarea, {
        whitelist: ['alpha', 'beta'],
      })
    })

    it('should return array of tag objects', () => {
      tagInput.addTags(['alpha', 'beta'])

      expect(tagInput.value).toEqual([{ value: 'alpha' }, { value: 'beta' }])
    })

    it('should return empty array when no tags', () => {
      expect(tagInput.value).toEqual([])
    })
  })
})
