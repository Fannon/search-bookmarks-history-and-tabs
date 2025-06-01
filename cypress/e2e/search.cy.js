/* eslint-disable cypress/no-unnecessary-waiting */
describe('Search View', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#result-list').should('have.length', 1).find('#results-loading')
    })
    it('completes the initializing phase without errors', () => {
      cy.get('#results-loading').should('not.exist').checkNoErrors()
    })
  })

  describe('Result Navigation', () => {
    it('first result is highlighted', () => {
      cy.get('#search-input')
        .type(`JSON Edit`)
      cy.get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
      cy.get('#search-input')
        .type('{downarrow}')
      cy.get('#result-list li')
        .each((el, index) => {
          if (index === 1) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
      cy.get('#search-input')
        .type('{uparrow}')
       
      cy.get('#result-list li')
        .each((el, index) => {
          if (index === 0) {
            expect(el[0].id).to.equal('selected-result')
          } else {
            expect(el[0].id).to.not.equal('selected-result')
          }
        })
      cy.checkNoErrors()
    })
  })

  describe('Search result item', () => {
    it('includes everything expected (title, URL etc.)', () => {
      cy.get('#search-input')
        .type(`JSON`)
      cy.get('#result-list')
      .find('[x-original-id=7]') // Bookmark item
      cy.get('#result-list')
      .find('[x-original-id=5]') // Tab item
      cy.get('#result-list')
        .find('[x-original-id=6]') // History item
      cy.get('#result-list')
        .find('[x-original-id=9]') // Search engine

      // Check that we have a result with a title returned
      cy.get('[x-original-id=7]')
        .find('.title')
        .contains('JSON')

      // Check that we have a result with an URL returned
      cy.get('[x-original-id=7]')
        .find('.url')
        .contains('json')

      // expect #json tag
      cy.get('[x-original-id=7]')
        .find('span.tags')
        .contains('#json')

      // expect ~Tools folder
      cy.get('[x-original-id=7]')
        .find('span.folder')
        .contains('~Tools')

      // expect score badge
      cy.get('[x-original-id=7]')
        .find('span.score')

      cy.checkNoErrors()
    })
  })

  describe('Precise search', () => {
    it('can execute search successfully', () => {
      cy.get('#search-approach-toggle').should('have.text', 'PRECISE')
      cy.get('#search-input')
        .type(`JSON`)
        // Make sure we get result of all types
      cy.get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=7]')
      cy.get('#result-list')
        .find('li.bookmark')
      cy.get('#result-list')
        .find('li.history')
      cy.get('#result-list')
        .find('li.tab')
      cy.get('#result-list')
        .find('li.bookmark')
      cy.checkNoErrors()
    })
    it('can execute search with non-ASCII chars successfully', () => {
      cy.get('#search-approach-toggle')
      cy.get('#search-input')
        .type(`äe指事字₽`)
        // Only make sure that search doesn't crash
      cy.get('#result-list')
        .should('not.have.length', 0)
      cy.checkNoErrors()
    })
  })

  describe('Fuzzy search', {
    // Does not run on firefox headless, but works on firefox desktop
    browser: '!firefox'
  }, () => {
    it('can switch to fuzzy search successfully', () => {
      cy.get('#search-approach-toggle').should('have.text', 'PRECISE') 
      cy.get('#search-approach-toggle').click()
      cy.wait(100)
      cy.get('#search-approach-toggle').should('not.have.text', 'PRECISE')
      cy.get('#search-approach-toggle').should('have.text', 'FUZZY')
      cy.get('#search-input').type(`JSON`)
      cy.get('li.bookmark').checkNoErrors()
    })

    it('can execute a fuzzy search successfully', () => {
      cy.get('#search-approach-toggle').should('have.text', 'PRECISE')
      cy.get('#search-approach-toggle').click()
      cy.wait(100)
      cy.get('#search-approach-toggle').should('have.text', 'FUZZY')
      cy.get('#search-input')
        .type(`JSON`)
      cy.get('li.bookmark')
      cy.get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=7]')
        // Check that we have all kinds of results
      cy.get('#result-list')
        .find('li.bookmark')
      cy.get('#result-list')
        .find('li.history')
      cy.get('#result-list')
        .find('li.tab')
      cy.get('#result-list')
        .find('li.bookmark')
      cy.checkNoErrors()
    })

    it('can execute search with non-ASCII chars successfully', () => {
      cy.get('#search-approach-toggle').should('have.text', 'PRECISE')
      cy.get('#search-approach-toggle').click()
      cy.wait(100)
      cy.get('#search-approach-toggle').should('have.text', 'FUZZY')
      cy.get('#search-input').type(`äe指事字₽`)
        // Only make sure that search doesn't crash
      cy.get('#result-list')
        .should('not.have.length', 0)
      cy.checkNoErrors()
    })
  })

  describe('Direct URL Search', () => {
    it('can execute a direct URL search successfully', () => {
      cy.get('#search-input')
        .type(`example.com`)
        cy.get('#result-list')
        .should('not.have.length', 0)
      cy.get('li.direct')
        .should('have.length', 1)
        .should('have.attr', 'x-open-url', 'https://example.com')
      cy.checkNoErrors()
    })
  })

  describe('Bookmark search', () => {
    it('Empty search returns recent bookmarks', () => {
      cy.get('#search-input')
        .type(`b `)
      cy.get('#result-list')
        .find('li.bookmark')
      cy.get('#result-list')
        .find('[x-original-id=7]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
      cy.checkNoErrors()
    })
    it('returns only bookmark results', () => {
      cy.get('#search-input')
        .type(`b JSON`)
      cy.get('#result-list')
        .find('[x-original-id=7]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
      cy.get('#result-counter').should('have.text', '(5)')
      cy.checkNoErrors()
    })
  })

  describe('History search', () => {
    it('Empty search returns recent history', () => {
      cy.get('#search-input')
        .type(`h `)
      cy.get('#result-list')
        .find('li.history')
      cy.get('#result-list')
        .find('[x-original-id=6]')
      cy.get('.tab')
        .should('not.exist')
      cy.get('.bookmark')
        .should('not.exist')
      cy.checkNoErrors()
    })
    it('only the history and tab results', () => {
      cy.get('#search-input')
        .type(`h JSON`)
      cy.get('#result-list')
        .find('[x-original-id=8]') // history
      cy.get('#result-list')
        .find('[x-original-id=185]') // tab
      cy.get('.bookmark')
        .should('not.exist')
      cy.get('#result-counter')
        .contains('(6)')
      cy.checkNoErrors()
    })
  })

  describe('Tab search', () => {
    it('Empty search returns all open tabs', () => {
      cy.get('#search-input')
        .type(`t `)
      cy.get('#result-list')
        .find('li.tab')
      cy.get('#result-list')
        .find('[x-original-id=179]')
      cy.get('.bookmark')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
      cy.checkNoErrors()
    })
    it('returns only the tab results', () => {
      cy.get('#search-input')
        .type(`t JSON`)
      cy.get('#result-list')
        .find('[x-original-id=185]')
      cy.get('#result-list')
        .should('have.length', 1)
      cy.get('.bookmark')
        .should('not.exist')
      cy.get('.history')
        .should('not.exist')
      cy.get('#result-counter')
        .contains('(1)')
      cy.checkNoErrors()
    })
  })
})
