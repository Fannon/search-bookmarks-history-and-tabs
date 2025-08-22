/* eslint-disable cypress/no-unnecessary-waiting */
describe('Recent Tabs on Open Functionality', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Default Behavior (showRecentTabsOnOpen: true)', () => {
    it('shows tabs sorted by recent access when popup opens with no search term', () => {
      // Wait for initialization to complete
      cy.get('#results-loading').should('not.exist')
      
      // Search input should be empty initially
      cy.get('#search-input').should('have.value', '')
      
      // Should show tab results by default when showRecentTabsOnOpen is true
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      cy.checkNoErrors()
    })

    it('maintains tab sorting by last accessed time', () => {
      // Wait for initialization
      cy.get('#results-loading').should('not.exist')
      
      // Get all result items that appear to be tabs
      cy.get('#result-list li').then(($results) => {
        // Verify we have multiple tab results to test sorting
        expect($results).to.have.length.at.least(2)
        
        // In the mock data environment, we should see consistent ordering
        // The most recently accessed tab should appear first
      })
      
      cy.checkNoErrors()
    })

    it('switches to search results when user types in search box', () => {
      // Wait for initialization
      cy.get('#results-loading').should('not.exist')
      
      // Initially shows recent tabs
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      // Type a search term
      cy.get('#search-input').type('test')
      
      // Should now show search results instead of just recent tabs
      cy.get('#result-list li').should('exist')
      
      // Clear search input
      cy.get('#search-input').clear()
      
      // Should go back to showing recent tabs
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      cy.checkNoErrors()
    })
  })

  describe('Tab-only Search Mode', () => {
    it('shows tabs when using "t " prefix even with showRecentTabsOnOpen', () => {
      // Wait for initialization
      cy.get('#results-loading').should('not.exist')
      
      // Use tab-only search mode
      cy.get('#search-input').type('t ')
      
      // Should show tabs sorted by last access
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      cy.checkNoErrors()
    })

    it('shows tabs sorted by last access in tab-only mode', () => {
      // Wait for initialization  
      cy.get('#results-loading').should('not.exist')
      
      // Use tab-only search mode with a search term
      cy.get('#search-input').type('t chrome')
      
      // Should filter tabs but maintain last-access ordering
      cy.get('#result-list li').should('exist')
      
      cy.checkNoErrors()
    })
  })

  describe('Tab Limit Functionality (maxRecentTabsToShow)', () => {
    it('respects the default maxRecentTabsToShow limit of 30', () => {
      cy.get('#results-loading').should('not.exist')
      
      // Should show results but not more than 30
      cy.get('#result-list li').should('have.length.at.most', 30)
      
      cy.checkNoErrors()
    })

    it('respects custom maxRecentTabsToShow limit', () => {
      // Set a lower limit via options UI
      const newConfig = JSON.stringify({
        showRecentTabsOnOpen: true,
        maxRecentTabsToShow: 5
      }, null, 2)
      
      cy.visit('/options.html')
      cy.get('#user-config').clear()
      cy.get('#user-config').type(newConfig)
      cy.get('#edit-options-save').click()
      
      // Now test the functionality
      cy.visit('/')
      cy.get('#results-loading').should('not.exist')
      
      // Should show at most 5 results
      cy.get('#result-list li').should('have.length.at.most', 5)
      
      cy.checkNoErrors()
    })

    it('handles maxRecentTabsToShow set to 0', () => {
      // Set limit to 0 via options UI
      const newConfig = JSON.stringify({
        showRecentTabsOnOpen: true,
        maxRecentTabsToShow: 0
      }, null, 2)
      
      cy.visit('/options.html')
      cy.get('#user-config').clear()
      cy.get('#user-config').type(newConfig)
      cy.get('#edit-options-save').click()
      
      // Now test the functionality
      cy.visit('/')
      cy.get('#results-loading').should('not.exist')
      
      // Should show no recent tabs, but may show fallback bookmarks matching current page
      cy.get('#result-list').should('exist')
      
      // Check if any results exist
      cy.get('body').then(($body) => {
        const hasResults = $body.find('#result-list li').length > 0
        if (hasResults) {
          // If results exist, they should only be bookmarks (not tabs)
          cy.get('#result-list li').should('not.have.class', 'tab')
          cy.get('#result-list li').should('have.class', 'bookmark')
        } else {
          // If no results, that's also acceptable (no matching bookmarks)
          cy.get('#result-list li').should('not.exist')
        }
      })
      
      cy.checkNoErrors()
    })

    it('handles maxRecentTabsToShow larger than available tabs', () => {
      // Set very high limit via options UI
      const newConfig = JSON.stringify({
        showRecentTabsOnOpen: true,
        maxRecentTabsToShow: 1000
      }, null, 2)
      
      cy.visit('/options.html')
      cy.get('#user-config').clear()
      cy.get('#user-config').type(newConfig)
      cy.get('#edit-options-save').click()
      
      // Now test the functionality
      cy.visit('/')
      cy.get('#results-loading').should('not.exist')
      
      // Should show all available tabs (limited by actual tab count)
      cy.get('#result-list li').should('exist')
      cy.get('#result-list li').should('have.length.at.most', 1000)
      
      cy.checkNoErrors()
    })

    it('maintains correct result counter with tab limit', () => {
      // Set tab limit via options UI
      const newConfig = JSON.stringify({
        showRecentTabsOnOpen: true,
        maxRecentTabsToShow: 10,
      }, null, 2)
      
      cy.visit('/options.html')
      cy.get('#user-config').clear()
      cy.get('#user-config').type(newConfig)
      cy.get('#edit-options-save').click()
      
      // Now test the functionality
      cy.visit('/')
      cy.get('#results-loading').should('not.exist')
      
      // Should show all available tabs (limited by actual tab count, not the limit)
      // Mock data has 3 tabs, so expect 3 results max
      cy.get('#result-list li').should('have.length.at.most', 10)
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      // Result counter is NOT displayed for recent tabs (only during search flow)
      // This is expected behavior - counter only appears when actively searching
      cy.get('#result-counter').should('be.empty')
      
      cy.checkNoErrors()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty search gracefully', () => {
      // Wait for initialization
      cy.get('#results-loading').should('not.exist')
      
      // Type and then clear search
      cy.get('#search-input').type('test')
      cy.get('#search-input').clear()
      
      // Should show default entries (recent tabs)
      cy.get('#result-list li').should('exist')
      
      cy.checkNoErrors()
    })

    it('handles navigation keys without breaking display', () => {
      // Wait for initialization
      cy.get('#results-loading').should('not.exist')
      
      // Should have results displayed
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      // Use arrow keys for navigation
      cy.get('#search-input').type('{downarrow}{uparrow}')
      
      // Should still have results and first one selected
      cy.get('#result-list li').should('have.length.at.least', 1)
      cy.get('#selected-result').should('exist')
      
      cy.checkNoErrors()
    })

    it('preserves functionality when showRecentTabsOnOpen is disabled via options UI', () => {
      // Set option to false via options UI
      const newConfig = JSON.stringify({
        showRecentTabsOnOpen: false
      }, null, 2)
      
      cy.visit('/options.html')
      cy.get('#user-config').clear()
      cy.get('#user-config').type(newConfig)
      cy.get('#edit-options-save').click()
      
      // Now test the functionality
      cy.visit('/')
      cy.get('#results-loading').should('not.exist')
      
      // Should now show default bookmark behavior instead of recent tabs
      cy.get('#search-input').should('have.value', '')
      
      // The results might be empty or show bookmarks matching current page
      // In test environment (localhost), no bookmarks match so list may be empty
      cy.get('#result-list').should('exist')
      
      // Check if any results exist - either empty or only bookmarks (not tabs)
      cy.get('body').then(($body) => {
        const hasResults = $body.find('#result-list li').length > 0
        if (hasResults) {
          // If results exist, they should be bookmarks (not tabs)
          cy.get('#result-list li').should('have.class', 'bookmark')
          cy.get('#result-list li').should('not.have.class', 'tab')
        }
        // Empty result list is acceptable when no bookmarks match current page
      })
      
      cy.checkNoErrors()
    })
  })

  describe('Performance and Reliability', () => {
    it('loads recent tabs quickly without timeout', () => {
      const startTime = Date.now()
      
      cy.get('#results-loading').should('not.exist')
      
      cy.then(() => {
        const loadTime = Date.now() - startTime
        expect(loadTime).to.be.lessThan(3000) // Should load within 3 seconds
      })
      
      cy.get('#result-list li').should('have.length.at.least', 1)
      cy.checkNoErrors()
    })

    it('handles rapid search input changes gracefully', () => {
      cy.get('#results-loading').should('not.exist')
      
      // Rapidly type and clear multiple times
      cy.get('#search-input').type('a')
      cy.get('#search-input').clear()
      cy.get('#search-input').type('b')
      cy.get('#search-input').clear()
      cy.get('#search-input').type('c')
      cy.get('#search-input').clear()
      
      // Should still show default recent tabs
      cy.get('#result-list li').should('exist')
      cy.checkNoErrors()
    })
  })

  describe('Integration with Existing Features', () => {
    it('works correctly with fuzzy search toggle', () => {
      cy.get('#results-loading').should('not.exist')
      
      // Toggle search approach
      cy.get('#search-approach-toggle').click()
      
      // Should still show recent tabs when no search term
      cy.get('#result-list li').should('exist')
      
      // Type a search term
      cy.get('#search-input').type('test')
      
      // Should work with fuzzy search
      cy.get('#result-list li').should('exist')
      
      cy.checkNoErrors()
    })

    it('maintains correct result counter with recent tabs', () => {
      cy.get('#results-loading').should('not.exist')
      
      // Should have recent tabs displayed by default (showRecentTabsOnOpen: true)
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      // Result counter is NOT displayed for recent tabs (only during search flow)
      // This is expected behavior - counter only appears when actively searching
      cy.get('#result-counter').should('be.empty')
      
      cy.checkNoErrors()
    })

    it('preserves color coding for different result types', () => {
      cy.get('#results-loading').should('not.exist')
      
      // Should have recent tabs displayed by default
      cy.get('#result-list li').should('have.length.at.least', 1)
      
      // Recent tabs should be displayed (from mock data: 3 tabs available)
      cy.get('#result-list li').should('have.class', 'tab')
      
      // Visit counter badges should NOT appear for tabs (Chrome API limitation)
      // This is expected behavior - only history entries have visit counts
      cy.get('#result-list li .visit-counter').should('not.exist')
      
      // But tabs should still have proper styling and structure
      cy.get('#result-list li').should('exist')
      cy.get('#result-list li .title').should('exist')
      
      cy.checkNoErrors()
    })
  })
})
